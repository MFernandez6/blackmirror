import { describe, expect, it } from "vitest";
import { canAccessClaim } from "@/lib/claims/access";
import { parseStoredObjectUrl, photoHref } from "@/lib/storage";

describe("canAccessClaim", () => {
  const claim = { assignedAdjusterId: "a1" };

  it("limits adjusters to their assigned files", () => {
    expect(canAccessClaim({ id: "a1", role: "ADJUSTER" }, claim)).toBe(true);
    expect(canAccessClaim({ id: "a2", role: "ADJUSTER" }, claim)).toBe(false);
    expect(canAccessClaim({ id: "a2", role: "ADJUSTER" }, { assignedAdjusterId: null })).toBe(false);
  });

  it("lets admins and viewers see every file", () => {
    expect(canAccessClaim({ id: "x", role: "ADMIN" }, claim)).toBe(true);
    expect(canAccessClaim({ id: "x", role: "VIEWER" }, claim)).toBe(true);
  });
});

describe("parseStoredObjectUrl", () => {
  const base = "https://ref.supabase.co/storage/v1/object";

  it("reads bucket and decoded path from canonical, signed and authenticated URLs", () => {
    expect(parseStoredObjectUrl(`${base}/public/claim-documents/claims/BL-26-0001/a%20b.jpg`)).toEqual({
      bucket: "claim-documents",
      objectPath: "claims/BL-26-0001/a b.jpg",
    });
    expect(parseStoredObjectUrl(`${base}/sign/claim-documents/x/y.jpg?token=abc`)).toEqual({
      bucket: "claim-documents",
      objectPath: "x/y.jpg",
    });
    expect(parseStoredObjectUrl(`${base}/authenticated/claim-documents/x.jpg`)?.objectPath).toBe("x.jpg");
  });

  it("rejects unknown buckets and foreign URLs", () => {
    expect(parseStoredObjectUrl(`${base}/public/avatars/x.jpg`)).toBeNull();
    expect(parseStoredObjectUrl("https://evil.example/x.jpg")).toBeNull();
  });

  it("hands the browser the access-checked route, never the object URL", () => {
    expect(photoHref("p1")).toBe("/api/inspections/photos/p1/file");
  });
});
