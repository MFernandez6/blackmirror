import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { canEdit, getSession, resolveSessionAdjuster } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncPushSchema } from "@/lib/schemas/inspection";
import {
  toCachedClaim,
  toSyncInspection,
  toSyncItem,
  toSyncPhoto,
  ensurePropertyForClaim,
} from "@/lib/inspection/serialize";
import { canAccessClaim } from "@/lib/claims/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  const adjuster = session ? await resolveSessionAdjuster(session) : null;
  if (!adjuster) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const where =
    adjuster.role === "ADJUSTER"
      ? {
          OR: [
            { adjusterId: adjuster.id },
            { claim: { assignedAdjusterId: adjuster.id } },
          ],
        }
      : {};

  const rows = await prisma.inspection.findMany({
    where,
    include: {
      claim: {
        select: {
          claimNumber: true,
          propertyAddress: true,
          zipCode: true,
          county: true,
        },
      },
      adjuster: { select: { name: true } },
      items: {
        include: { photos: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const claimIds = Array.from(
    new Set([
      ...rows.map((r) => r.claimId),
      ...(
        await prisma.claim.findMany({
          where: { isArchived: false, assignedAdjusterId: adjuster.id },
          select: { id: true },
        })
      ).map((c) => c.id),
    ])
  );
  const claims = await Promise.all(claimIds.map((id) => toCachedClaim(id)));

  return NextResponse.json({
    inspections: rows.map(toSyncInspection),
    items: rows.flatMap((r) => r.items.map(toSyncItem)),
    photos: rows.flatMap((r) =>
      r.items.flatMap((item) =>
        item.photos.map((photo) =>
          toSyncPhoto({ ...photo, inspectionItem: { inspectionId: r.id } })
        )
      )
    ),
    claims,
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  const adjuster = session ? await resolveSessionAdjuster(session) : null;
  if (!adjuster) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!canEdit(adjuster.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = syncPushSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { items, photos } = parsed.data;

  const claimIds = Array.from(new Set(parsed.data.inspections.map((row) => row.claimId)));
  const claims = await prisma.claim.findMany({
    where: { id: { in: claimIds } },
    select: { id: true, assignedAdjusterId: true },
  });
  const allowedClaimIds = new Set(
    claims.filter((claim) => canAccessClaim(adjuster, claim)).map((claim) => claim.id)
  );
  const inspections = parsed.data.inspections.filter(
    (row) =>
      allowedClaimIds.has(row.claimId) &&
      (adjuster.role !== "ADJUSTER" || row.adjusterId === adjuster.id)
  );
  for (const claimId of Array.from(new Set(inspections.map((row) => row.claimId)))) {
    await ensurePropertyForClaim(claimId);
  }

  const txOpts = { timeout: 20_000, maxWait: 10_000 } as const;

  await prisma.$transaction(async (tx) => {
    for (const row of inspections) {
      const existing = await tx.inspection.findUnique({
        where: { id: row.id },
        select: { clientRev: true, updatedAt: true, adjusterId: true, claimId: true },
      });
      if (
        existing &&
        adjuster.role === "ADJUSTER" &&
        (existing.adjusterId !== adjuster.id || existing.claimId !== row.claimId)
      ) {
        continue;
      }
      if (
        existing &&
        (existing.clientRev > row.clientRev ||
          (existing.clientRev === row.clientRev &&
            existing.updatedAt > new Date(row.updatedAt)))
      ) {
        continue;
      }

      const property =
        (await tx.property.findUnique({
          where: { id: row.propertyId },
          select: { id: true },
        })) ??
        (await tx.property.findFirst({
          where: { claimId: row.claimId },
          select: { id: true },
          orderBy: { createdAt: "asc" },
        }));
      if (!property) continue;

      const data = {
        claimId: row.claimId,
        propertyId: property.id,
        adjusterId: row.adjusterId,
        perilTemplate: row.perilTemplate,
        status: row.status,
        startedAt: new Date(row.startedAt),
        completedAt: row.completedAt ? new Date(row.completedAt) : null,
        narrativeDraft: row.narrativeDraft,
        narrativeFinal: row.narrativeFinal,
        clientRev: row.clientRev,
        syncedAt: new Date(),
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      };

      await tx.inspection.upsert({
        where: { id: row.id },
        create: { id: row.id, ...data },
        update: data,
      });
    }
  }, txOpts);

  const ITEM_CHUNK = 20;
  for (let i = 0; i < items.length; i += ITEM_CHUNK) {
    const slice = items.slice(i, i + ITEM_CHUNK);
    await prisma.$transaction(async (tx) => {
      for (const row of slice) {
        const parent = await tx.inspection.findUnique({
          where: { id: row.inspectionId },
          select: { adjusterId: true, claimId: true },
        });
        if (!parent) continue;
        if (adjuster.role === "ADJUSTER" && parent.adjusterId !== adjuster.id) {
          continue;
        }

        const existing = await tx.inspectionItem.findUnique({
          where: { id: row.id },
          select: { clientRev: true, updatedAt: true, adjusterConfirmed: true, inspectionId: true },
        });
        if (existing && existing.inspectionId !== row.inspectionId) continue;
        if (
          existing &&
          (existing.clientRev > row.clientRev ||
            (existing.clientRev === row.clientRev &&
              existing.updatedAt > new Date(row.updatedAt)))
        ) {
          continue;
        }

        const data: Prisma.InspectionItemUncheckedCreateInput = {
          id: row.id,
          inspectionId: row.inspectionId,
          category: row.category,
          indicatorType: row.indicatorType,
          presence: row.presence,
          severity: row.severity,
          confidence: row.confidence,
          notes: row.notes,
          measurementValue: row.measurementValue,
          measurementUnit: row.measurementUnit,
          gpsLat: row.gpsLat,
          gpsLng: row.gpsLng,
          capturedAt: row.capturedAt ? new Date(row.capturedAt) : null,
          sortOrder: row.sortOrder,
          clientRev: row.clientRev,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
          aiSuggestedCategory: row.aiSuggestedCategory ?? null,
          aiSuggestedIndicator: row.aiSuggestedIndicator ?? null,
          aiConfidence: row.aiConfidence ?? null,
          aiEstimatedSeverity: row.aiEstimatedSeverity ?? null,
          aiRationale: row.aiRationale ?? null,
          similarReferenceIds: (row.similarReferenceIds ??
            []) as Prisma.InputJsonValue,
          adjusterConfirmed: row.adjusterConfirmed ?? false,
          adjusterFinalCategory: row.adjusterFinalCategory ?? null,
        };

        await tx.inspectionItem.upsert({
          where: { id: row.id },
          create: data,
          update: {
            presence: data.presence,
            severity: data.severity,
            confidence: data.confidence,
            notes: data.notes,
            measurementValue: data.measurementValue,
            measurementUnit: data.measurementUnit,
            gpsLat: data.gpsLat,
            gpsLng: data.gpsLng,
            capturedAt: data.capturedAt,
            sortOrder: data.sortOrder,
            clientRev: data.clientRev,
            updatedAt: data.updatedAt,
            aiSuggestedCategory: data.aiSuggestedCategory,
            aiSuggestedIndicator: data.aiSuggestedIndicator,
            aiConfidence: data.aiConfidence,
            aiEstimatedSeverity: data.aiEstimatedSeverity,
            aiRationale: data.aiRationale,
            similarReferenceIds: data.similarReferenceIds,
            adjusterConfirmed: data.adjusterConfirmed,
            adjusterFinalCategory: data.adjusterFinalCategory,
          },
        });

        if (data.adjusterConfirmed && !existing?.adjusterConfirmed && data.aiSuggestedIndicator) {
          await tx.claimAuditEvent.create({
            data: {
              claimId: parent.claimId,
              actorId: adjuster.id,
              action: "INSPECTION_FINDING_CONFIRMED",
              entityType: "InspectionItem",
              entityId: row.id,
              summary: `${adjuster.name} confirmed the AI-suggested finding "${row.indicatorType}".`,
              meta: {
                inspectionId: row.inspectionId,
                aiSuggestedIndicator: data.aiSuggestedIndicator,
                severity: data.severity ?? null,
              },
            },
          });
        }
      }
    }, txOpts);
  }

  if (photos.length) {
    await prisma.$transaction(async (tx) => {
      for (const row of photos) {
        const inspection = await tx.inspection.findUnique({
          where: { id: row.inspectionId },
          select: { adjusterId: true },
        });
        if (!inspection) continue;
        if (
          adjuster.role === "ADJUSTER" &&
          inspection.adjusterId !== adjuster.id
        ) {
          continue;
        }

        const existing = await tx.photo.findUnique({
          where: { id: row.id },
          select: { clientRev: true, updatedAt: true, inspectionId: true },
        });
        // Photo rows and their storage URLs are created only by commit-photo; sync
        // carries metadata edits and never a client-supplied URL.
        if (!existing || existing.inspectionId !== row.inspectionId) continue;
        if (
          existing.clientRev > row.clientRev ||
          (existing.clientRev === row.clientRev &&
            existing.updatedAt > new Date(row.updatedAt))
        ) {
          continue;
        }

        await tx.photo.update({
          where: { id: row.id },
          data: {
            caption: row.caption,
            exifData: row.exifData as Prisma.InputJsonValue | undefined,
            annotations: row.annotations as Prisma.InputJsonValue,
            capturedAt: new Date(row.capturedAt),
            clientRev: row.clientRev,
            updatedAt: new Date(row.updatedAt),
          },
        });
      }
    }, txOpts);
  }

  return NextResponse.json({ ok: true, syncedAt: new Date().toISOString() });
}
