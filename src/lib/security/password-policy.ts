export const PASSWORD_MIN_LENGTH = 12;

const COMMON = new Set([
  "password123!",
  "password1234",
  "passwordpassword",
  "123456789012",
  "qwertyuiop12",
  "blackline123",
  "blackbox1234",
  "letmein12345",
  "welcome12345",
  "adjuster1234",
]);

/** Returns a list of unmet requirements; empty means the password is acceptable. */
export function passwordProblems(password: string, context: { email?: string; name?: string } = {}): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push(`At least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (password.length > 128) problems.push("No more than 128 characters");
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    problems.push("Upper- and lower-case letters");
  }
  if (!/\d/.test(password)) problems.push("At least one number");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("At least one symbol");

  const lower = password.toLowerCase();
  if (COMMON.has(lower)) problems.push("Not a common or default password");
  const localPart = context.email?.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 4 && lower.includes(localPart)) {
    problems.push("Must not contain your email name");
  }
  for (const part of (context.name ?? "").toLowerCase().split(/\s+/)) {
    if (part.length >= 4 && lower.includes(part)) {
      problems.push("Must not contain your name");
      break;
    }
  }
  return problems;
}
