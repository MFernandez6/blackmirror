import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { openMfaSecret, verifyTotp } from "@/lib/security/totp";

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
const IP_WINDOW_MINUTES = 15;
const IP_MAX_FAILURES = 25;

/** Error codes surfaced to the login form through NextAuth's `error` field. */
export const LOGIN_ERRORS = {
  invalid: "INVALID_CREDENTIALS",
  locked: "ACCOUNT_LOCKED",
  throttled: "TOO_MANY_ATTEMPTS",
  mfaRequired: "MFA_REQUIRED",
  mfaInvalid: "MFA_INVALID",
  passwordChangeRequired: "PASSWORD_CHANGE_REQUIRED",
  mfaSetupRequired: "MFA_SETUP_REQUIRED",
} as const;

export class LoginError extends Error {}

let dummy: Promise<string> | null = null;
function dummyHash() {
  dummy ??= hash("blackbox-timing-equalizer", 10);
  return dummy;
}

type RequestLike = { headers?: Record<string, unknown> | Headers } | undefined;

function header(req: RequestLike, name: string): string | null {
  const h = req?.headers;
  if (!h) return null;
  if (typeof (h as Headers).get === "function") return (h as Headers).get(name);
  const v = (h as Record<string, unknown>)[name];
  return Array.isArray(v) ? String(v[0]) : typeof v === "string" ? v : null;
}

export function requestMeta(req: RequestLike) {
  const forwarded = header(req, "x-forwarded-for");
  return {
    ip: forwarded?.split(",")[0]?.trim() || header(req, "x-real-ip") || null,
    userAgent: header(req, "user-agent")?.slice(0, 300) ?? null,
  };
}

/** Request metadata for server actions, which have no `req` to pass; null outside a request scope. */
async function currentRequestMeta() {
  try {
    const { headers } = await import("next/headers");
    return requestMeta({ headers: headers() });
  } catch {
    return null;
  }
}

export async function recordAuthEvent(opts: {
  email: string;
  event: string;
  adjusterId?: string | null;
  app?: string;
  ip?: string | null;
  userAgent?: string | null;
  detail?: string | null;
}) {
  try {
    const meta = opts.ip === undefined && opts.userAgent === undefined ? await currentRequestMeta() : null;
    await prisma.authEvent.create({
      data: {
        email: opts.email.toLowerCase(),
        event: opts.event,
        adjusterId: opts.adjusterId ?? null,
        app: opts.app ?? "BLACKBOX",
        ip: opts.ip ?? meta?.ip ?? null,
        userAgent: opts.userAgent ?? meta?.userAgent ?? null,
        detail: opts.detail ?? null,
      },
    });
  } catch (e) {
    console.error("[auth] failed to record auth event", e);
  }
}

/**
 * Credential + lockout + MFA check shared by every login surface.
 * Throws LoginError with a LOGIN_ERRORS code; returns the adjuster on success.
 */
export async function verifyLogin(opts: {
  email: string;
  password: string;
  otp?: string | null;
  app: string;
  req?: RequestLike;
  /**
   * Apps without their own account page refuse sign-in until the user has
   * changed an admin-issued password (and, when required, enrolled admin MFA) in BLACKBOX.
   */
  requireAccountReady?: boolean;
}) {
  const email = opts.email.toLowerCase().trim();
  const meta = requestMeta(opts.req);

  if (meta.ip) {
    const since = new Date(Date.now() - IP_WINDOW_MINUTES * 60_000);
    const ipFailures = await prisma.authEvent.count({
      where: { ip: meta.ip, event: { in: ["LOGIN_FAILURE", "MFA_FAILURE"] }, createdAt: { gte: since } },
    });
    if (ipFailures >= IP_MAX_FAILURES) {
      await recordAuthEvent({ email, event: "THROTTLED", app: opts.app, ...meta });
      throw new LoginError(LOGIN_ERRORS.throttled);
    }
  }

  const adjuster = await prisma.adjuster.findUnique({ where: { email } });

  if (!adjuster || !adjuster.isActive) {
    // Equalize timing with the real bcrypt path
    await compare(opts.password, await dummyHash()).catch(() => false);
    await recordAuthEvent({ email, event: "LOGIN_FAILURE", app: opts.app, detail: adjuster ? "inactive" : "unknown", ...meta });
    throw new LoginError(LOGIN_ERRORS.invalid);
  }

  if (adjuster.lockedUntil && adjuster.lockedUntil > new Date()) {
    await recordAuthEvent({ email, event: "LOGIN_FAILURE", adjusterId: adjuster.id, app: opts.app, detail: "locked", ...meta });
    throw new LoginError(LOGIN_ERRORS.locked);
  }

  const valid = await compare(opts.password, adjuster.passwordHash);
  if (!valid) {
    const failed = adjuster.failedLoginCount + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await prisma.adjuster.update({
      where: { id: adjuster.id },
      data: {
        failedLoginCount: lock ? 0 : failed,
        lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : adjuster.lockedUntil,
      },
    });
    await recordAuthEvent({
      email,
      event: lock ? "LOCKED" : "LOGIN_FAILURE",
      adjusterId: adjuster.id,
      app: opts.app,
      detail: lock ? `${MAX_FAILED_LOGINS} failed attempts` : "bad password",
      ...meta,
    });
    if (lock) throw new LoginError(LOGIN_ERRORS.locked);
    throw new LoginError(LOGIN_ERRORS.invalid);
  }

  if (adjuster.mfaEnabledAt && adjuster.mfaSecret) {
    if (!opts.otp) throw new LoginError(LOGIN_ERRORS.mfaRequired);
    if (!verifyTotp(openMfaSecret(adjuster.mfaSecret), opts.otp)) {
      const failed = adjuster.failedLoginCount + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await prisma.adjuster.update({
        where: { id: adjuster.id },
        data: {
          failedLoginCount: lock ? 0 : failed,
          lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : adjuster.lockedUntil,
        },
      });
      await recordAuthEvent({ email, event: lock ? "LOCKED" : "MFA_FAILURE", adjusterId: adjuster.id, app: opts.app, ...meta });
      throw new LoginError(lock ? LOGIN_ERRORS.locked : LOGIN_ERRORS.mfaInvalid);
    }
  }

  if (opts.requireAccountReady) {
    const blocked = adjuster.mustChangePassword
      ? LOGIN_ERRORS.passwordChangeRequired
      : process.env.REQUIRE_ADMIN_MFA === "1" && adjuster.role === "ADMIN" && !adjuster.mfaEnabledAt
        ? LOGIN_ERRORS.mfaSetupRequired
        : null;
    if (blocked) {
      await prisma.adjuster.update({ where: { id: adjuster.id }, data: { failedLoginCount: 0 } });
      await recordAuthEvent({ email, event: "LOGIN_BLOCKED", adjusterId: adjuster.id, app: opts.app, detail: blocked, ...meta });
      throw new LoginError(blocked);
    }
  }

  await prisma.adjuster.update({
    where: { id: adjuster.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await recordAuthEvent({ email, event: "LOGIN_SUCCESS", adjusterId: adjuster.id, app: opts.app, ...meta });
  return adjuster;
}
