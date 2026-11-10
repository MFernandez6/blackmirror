import { randomInt } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const SYMBOLS = "!@#$%^&*-_+=?";

/** Single-use temporary password handed to a user by an admin; forces change at next login. */
export function generateTemporaryPassword(length = 16): string {
  const chars: string[] = [];
  chars.push("ABCDEFGHJKLMNPQRSTUVWXYZ"[randomInt(24)]);
  chars.push("abcdefghijkmnopqrstuvwxyz"[randomInt(25)]);
  chars.push("23456789"[randomInt(8)]);
  chars.push(SYMBOLS[randomInt(SYMBOLS.length)]);
  while (chars.length < length) chars.push(ALPHABET[randomInt(ALPHABET.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
