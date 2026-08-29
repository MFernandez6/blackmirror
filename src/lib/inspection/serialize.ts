import { Prisma, type LossType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { newId } from "@/lib/inspection/ids";
import type { CachedClaim } from "@/lib/offline/types";

function dec(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}

export async function ensurePropertyForClaim(claimId: string) {
  const existing = await prisma.property.findFirst({
    where: { claimId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: {
      propertyAddress: true,
      zipCode: true,
      county: true,
    },
  });
  if (!claim) throw new Error("CLAIM_NOT_FOUND");

  return prisma.property.create({
    data: {
      id: newId(),
      claimId,
      label: "Primary",
      address: claim.propertyAddress,
      zipCode: claim.zipCode,
      county: claim.county,
    },
  });
}

export async function toCachedClaim(claimId: string): Promise<CachedClaim> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: {
      assignedAdjuster: { select: { id: true, name: true } },
      claimants: {
        where: { isPrimaryContact: true },
        take: 1,
      },
    },
  });
  if (!claim) throw new Error("CLAIM_NOT_FOUND");
  const property = await ensurePropertyForClaim(claim.id);
  const primary = claim.claimants[0];
  return {
    id: claim.id,
    claimNumber: claim.claimNumber,
    lossType: claim.lossType,
    status: claim.status,
    dateOfLoss: claim.dateOfLoss.toISOString().slice(0, 10),
    propertyId: property.id,
    propertyAddress: claim.propertyAddress,
    zipCode: claim.zipCode,
    county: claim.county,
    assignedAdjusterId: claim.assignedAdjusterId,
    assignedAdjusterName: claim.assignedAdjuster?.name ?? null,
    primaryClaimant: primary
      ? `${primary.firstName} ${primary.lastName}`
      : null,
    latestInspectionId: null,
    latestInspectionStatus: null,
    cachedAt: new Date().toISOString(),
  };
}

export function toSyncInspection(row: {
  id: string;
  claimId: string;
  propertyId: string;
  adjusterId: string;
  perilTemplate: LossType;
  status: "IN_PROGRESS" | "COMPLETED";
  startedAt: Date;
  completedAt: Date | null;
  narrativeDraft: string | null;
  narrativeFinal: string | null;
  clientRev: number;
  syncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  claim?: { claimNumber: string; propertyAddress: string; zipCode: string; county: string };
  adjuster?: { name: string };
}) {
  return {
    id: row.id,
    claimId: row.claimId,
    claimNumber: row.claim?.claimNumber ?? "",
    propertyId: row.propertyId,
    propertyAddress: row.claim?.propertyAddress ?? "",
    zipCode: row.claim?.zipCode ?? "",
    county: row.claim?.county ?? "",
    adjusterId: row.adjusterId,
    adjusterName: row.adjuster?.name ?? "",
    perilTemplate: row.perilTemplate,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    narrativeDraft: row.narrativeDraft,
    narrativeFinal: row.narrativeFinal,
    clientRev: row.clientRev,
    syncedAt: row.syncedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSyncItem(row: {
  id: string;
  inspectionId: string;
  category: string;
  indicatorType: string;
  presence: string;
  severity: string | null;
  confidence: string | null;
  notes: string | null;
  measurementValue: Prisma.Decimal | number | null;
  measurementUnit: string | null;
  gpsLat: Prisma.Decimal | number | null;
  gpsLng: Prisma.Decimal | number | null;
  capturedAt: Date | null;
  sortOrder: number;
  clientRev: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    category: row.category,
    indicatorType: row.indicatorType,
    presence: row.presence,
    severity: row.severity,
    confidence: row.confidence,
    notes: row.notes,
    measurementValue: dec(row.measurementValue),
    measurementUnit: row.measurementUnit,
    gpsLat: dec(row.gpsLat),
    gpsLng: dec(row.gpsLng),
    capturedAt: row.capturedAt?.toISOString() ?? null,
    sortOrder: row.sortOrder,
    clientRev: row.clientRev,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    aiSuggestedCategory: "aiSuggestedCategory" in row ? row.aiSuggestedCategory : null,
    aiSuggestedIndicator: "aiSuggestedIndicator" in row ? row.aiSuggestedIndicator : null,
    aiConfidence: "aiConfidence" in row ? row.aiConfidence : null,
    aiEstimatedSeverity: "aiEstimatedSeverity" in row ? row.aiEstimatedSeverity : null,
    aiRationale: "aiRationale" in row ? row.aiRationale : null,
    similarReferenceIds: Array.isArray(
      (row as unknown as { similarReferenceIds?: unknown }).similarReferenceIds
    )
      ? ((row as unknown as { similarReferenceIds: string[] }).similarReferenceIds)
      : [],
    adjusterConfirmed: Boolean(
      (row as { adjusterConfirmed?: boolean }).adjusterConfirmed
    ),
    adjusterFinalCategory:
      (row as { adjusterFinalCategory?: string | null }).adjusterFinalCategory ?? null,
  };
}

export function toSyncPhoto(row: {
  id: string;
  inspectionItemId: string | null;
  inspectionId?: string;
  url: string;
  caption: string | null;
  exifData: unknown;
  annotations: unknown;
  capturedAt: Date;
  clientRev: number;
  createdAt: Date;
  updatedAt: Date;
  inspectionItem?: { inspectionId: string };
}) {
  return {
    id: row.id,
    inspectionItemId: row.inspectionItemId,
    inspectionId: row.inspectionId ?? row.inspectionItem?.inspectionId ?? "",
    url: row.url,
    caption: row.caption,
    exifData: row.exifData,
    annotations: Array.isArray(row.annotations) ? row.annotations : [],
    capturedAt: row.capturedAt.toISOString(),
    clientRev: row.clientRev,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
