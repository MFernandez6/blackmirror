import type { AdjusterRole } from "@prisma/client";

/** Same rule as BLACKBOX: adjusters work only their assigned files; admins and viewers see all. */
export function canAccessClaim(
  adjuster: { id: string; role: AdjusterRole },
  claim: { assignedAdjusterId: string | null }
): boolean {
  return adjuster.role !== "ADJUSTER" || claim.assignedAdjusterId === adjuster.id;
}
