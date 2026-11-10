import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, openMfaSecret, sealMfaSecret, totpAt, verifyTotp } from "@/lib/security/totp";
import { passwordProblems } from "@/lib/security/password-policy";
import { generateTemporaryPassword } from "@/lib/security/temporary-password";
import { detectAllowedFile } from "@/lib/security/file-signature";
import { matchesAnyKey, safeEqual } from "@/lib/security/safe-compare";

describe("TOTP", () => {
  it("matches the RFC 6238 SHA-1 test vector", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    expect(totpAt(secret, 59_000)).toBe("287082");
    expect(totpAt(secret, 1_111_111_109_000)).toBe("081804");
  });

  it("round-trips base32", () => {
    const buf = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(base32Decode(base32Encode(buf))).toEqual(buf);
  });

  it("accepts the adjacent time step and rejects others", () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    expect(verifyTotp(secret, totpAt(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpAt(secret, now - 120_000), now)).toBe(false);
    expect(verifyTotp(secret, "abc123", now)).toBe(false);
  });

  it("seals and opens the secret with MFA_ENCRYPTION_KEY", () => {
    process.env.MFA_ENCRYPTION_KEY = "test-key";
    const secret = generateTotpSecret();
    const sealed = sealMfaSecret(secret);
    expect(sealed.startsWith("enc:v1:")).toBe(true);
    expect(openMfaSecret(sealed)).toBe(secret);
    delete process.env.MFA_ENCRYPTION_KEY;
  });
});

describe("password policy", () => {
  it("rejects the old seed default", () => {
    expect(passwordProblems("Password123!").length).toBeGreaterThan(0);
  });

  it("rejects passwords containing the user's name", () => {
    expect(passwordProblems("Fernandez-2027!x", { name: "Miguel Fernandez" })).toContain("Must not contain your name");
  });

  it("accepts a strong password", () => {
    expect(passwordProblems("Tidewater#Ledger42")).toEqual([]);
  });

  it("generates temporary passwords that satisfy the policy", () => {
    for (let i = 0; i < 50; i++) expect(passwordProblems(generateTemporaryPassword())).toEqual([]);
  });
});

describe("upload sniffing", () => {
  it("detects PDFs and images from bytes", () => {
    expect(detectAllowedFile(Buffer.from("%PDF-1.7\n"), "x.pdf")?.mime).toBe("application/pdf");
    expect(detectAllowedFile(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "photo.jpg")?.mime).toBe("image/jpeg");
  });

  it("rejects executables and scripts even with a document extension", () => {
    expect(detectAllowedFile(Buffer.from("MZ\x90\x00"), "invoice.pdf")).toBeNull();
    expect(detectAllowedFile(Buffer.from("<html><script>alert(1)</script>"), "page.html")).toBeNull();
  });

  it("accepts plain text only for text extensions", () => {
    expect(detectAllowedFile(Buffer.from("a,b\n1,2"), "data.csv")?.ext).toBe("csv");
    expect(detectAllowedFile(Buffer.from("a,b\n1,2"), "data.exe")).toBeNull();
  });
});

describe("service key comparison", () => {
  it("compares in constant time and ignores missing keys", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(matchesAnyKey("k2", [undefined, "k1", "k2"])).toBe(true);
    expect(matchesAnyKey(null, ["k1"])).toBe(false);
    expect(matchesAnyKey("", [""])).toBe(false);
  });
});
