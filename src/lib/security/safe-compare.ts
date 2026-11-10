import { createHash, timingSafeEqual } from "crypto";

/** Constant-time string equality (hashing first removes the length side channel). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** True when token matches any configured key, compared in constant time. */
export function matchesAnyKey(token: string | null, keys: Array<string | undefined>): boolean {
  if (!token) return false;
  let ok = false;
  for (const key of keys) {
    if (key && safeEqual(key, token)) ok = true;
  }
  return ok;
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  return (header.startsWith("Bearer ") ? header.slice(7) : header).trim() || null;
}
