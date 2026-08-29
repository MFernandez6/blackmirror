import { type NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import type { AdjusterRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/schemas/auth";

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
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AdjusterRole;
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60,
    updateAge: 30 * 60,
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
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const adjuster = await prisma.adjuster.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });

        if (!adjuster || !adjuster.isActive) return null;

        const valid = await compare(parsed.data.password, adjuster.passwordHash);
        if (!valid) return null;

        return {
          id: adjuster.id,
          email: adjuster.email,
          name: adjuster.name,
          role: adjuster.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.email = user.email;
      }
      const email =
        typeof token.email === "string" ? token.email.toLowerCase() : null;
      if (email) {
        try {
          const adjuster = await prisma.adjuster.findFirst({
            where: { email, isActive: true },
            select: { id: true, role: true },
          });
          if (adjuster) {
            token.id = adjuster.id;
            token.role = adjuster.role;
          }
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
      return session;
    },
  },
};

export function getSession() {
  return getServerSession(authOptions);
}

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
