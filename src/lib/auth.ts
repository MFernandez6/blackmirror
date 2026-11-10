import { type NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { AdjusterRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/schemas/auth";
import { LoginError, LOGIN_ERRORS, verifyLogin } from "@/lib/security/login-guard";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: AdjusterRole;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: AdjusterRole;
    sessionVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AdjusterRole;
    sessionVersion?: number;
    revoked?: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    // Absolute ceiling for a field day; idle sign-out is enforced client-side
    maxAge: 8 * 60 * 60,
    updateAge: 15 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        otp: { label: "Authenticator code", type: "text" },
      },
      async authorize(credentials, req) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) throw new Error(LOGIN_ERRORS.invalid);

        try {
          const adjuster = await verifyLogin({
            email: parsed.data.email,
            password: parsed.data.password,
            otp: credentials?.otp || null,
            app: "BLACKMIRROR",
            req,
            requireAccountReady: true,
          });
          return {
            id: adjuster.id,
            email: adjuster.email,
            name: adjuster.name,
            role: adjuster.role,
            sessionVersion: adjuster.sessionVersion,
          };
        } catch (e) {
          if (e instanceof LoginError) throw new Error(e.message);
          console.error("[auth] login failed", e);
          throw new Error(LOGIN_ERRORS.invalid);
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.email = user.email;
        token.sessionVersion = user.sessionVersion;
        token.revoked = false;
        return token;
      }
      if (token.revoked) return token;

      const email = typeof token.email === "string" ? token.email.toLowerCase() : null;
      if (email) {
        try {
          const adjuster = await prisma.adjuster.findUnique({
            where: { email },
            select: { id: true, role: true, isActive: true, sessionVersion: true },
          });
          if (
            !adjuster ||
            !adjuster.isActive ||
            (token.sessionVersion ?? 0) !== adjuster.sessionVersion
          ) {
            token.revoked = true;
            return token;
          }
          token.id = adjuster.id;
          token.role = adjuster.role;
        } catch {
          // keep existing token if DB is briefly unavailable
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as AdjusterRole;
      }
      if (token.revoked) {
        return { ...session, user: undefined } as unknown as typeof session;
      }
      return session;
    },
  },
};

export async function getSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session;
}

/**
 * Resolve the live Adjuster row for the current session.
 * Survives DB reseeds where JWT still holds a stale Adjuster.id.
 */
export async function resolveSessionAdjuster(session: {
  user?: { id?: string; email?: string | null; role?: AdjusterRole } | null;
}) {
  const email = session.user?.email?.toLowerCase();
  const id = session.user?.id;

  if (id) {
    const byId = await prisma.adjuster.findFirst({
      where: { id, isActive: true },
      select: { id: true, email: true, name: true, role: true },
    });
    if (byId) return byId;
  }

  if (email) {
    const byEmail = await prisma.adjuster.findFirst({
      where: { email, isActive: true },
      select: { id: true, email: true, name: true, role: true },
    });
    if (byEmail) return byEmail;
  }

  return null;
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export function canEdit(role: AdjusterRole): boolean {
  return role === "ADMIN" || role === "ADJUSTER";
}
