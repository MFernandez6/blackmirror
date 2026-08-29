import type { AdjusterRole, ClaimStatus, InspectionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toCachedClaim } from "@/lib/inspection/serialize";
import { isOpenClaimStatus } from "@/lib/inspection/labels";
import type { CachedClaim } from "@/lib/offline/types";

export type AssignedClaim = CachedClaim;

export async function listAssignedClaimsForAdjuster(adjuster: {
  id: string;
  role: AdjusterRole;
}): Promise<AssignedClaim[]> {
  const rows = await prisma.claim.findMany({
    where: {
      isArchived: false,
      assignedAdjusterId: adjuster.id,
    },
    select: { id: true, status: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!rows.length) return [];

  const latest = await prisma.inspection.findMany({
    where: {
      claimId: { in: rows.map((r) => r.id) },
      adjusterId: adjuster.id,
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, claimId: true, status: true, updatedAt: true },
  });

  const latestByClaim = new Map<
    string,
    { id: string; status: InspectionStatus; updatedAt: Date }
  >();
  for (const row of latest) {
    if (!latestByClaim.has(row.claimId)) latestByClaim.set(row.claimId, row);
  }

  const claims = await Promise.all(
    rows.map(async (row) => {
      const cached = await toCachedClaim(row.id);
      const inspection = latestByClaim.get(row.id);
      return {
        ...cached,
        status: row.status as ClaimStatus,
        latestInspectionId: inspection?.id ?? null,
        latestInspectionStatus: inspection?.status ?? null,
      };
    })
  );

  const order = new Map(rows.map((row, index) => [row.id, index]));
  return claims.sort((a, b) => {
    const aOpen = isOpenClaimStatus(a.status) ? 0 : 1;
    const bOpen = isOpenClaimStatus(b.status) ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  });
}
