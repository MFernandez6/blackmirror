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
} from "@/lib/inspection/serialize";

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

  const { inspections, items, photos } = parsed.data;

  await prisma.$transaction(async (tx) => {
    for (const row of inspections) {
      if (adjuster.role === "ADJUSTER" && row.adjusterId !== adjuster.id) {
        continue;
      }
      const existing = await tx.inspection.findUnique({
        where: { id: row.id },
        select: { clientRev: true, updatedAt: true },
      });
      if (
        existing &&
        (existing.clientRev > row.clientRev ||
          (existing.clientRev === row.clientRev &&
            existing.updatedAt > new Date(row.updatedAt)))
      ) {
        continue;
      }

      const data = {
        claimId: row.claimId,
        propertyId: row.propertyId,
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

    for (const row of items) {
      const parent = await tx.inspection.findUnique({
        where: { id: row.inspectionId },
        select: { adjusterId: true, clientRev: true },
      });
      if (!parent) continue;
      if (adjuster.role === "ADJUSTER" && parent.adjusterId !== adjuster.id) {
        continue;
      }

      const existing = await tx.inspectionItem.findUnique({
        where: { id: row.id },
        select: { clientRev: true, updatedAt: true },
      });
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
        similarReferenceIds: (row.similarReferenceIds ?? []) as Prisma.InputJsonValue,
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
    }

    for (const row of photos) {
      const inspection = await tx.inspection.findUnique({
        where: { id: row.inspectionId },
        select: { adjusterId: true },
      });
      if (!inspection) continue;
      if (adjuster.role === "ADJUSTER" && inspection.adjusterId !== adjuster.id) {
        continue;
      }

      const existing = await tx.photo.findUnique({
        where: { id: row.id },
        select: { clientRev: true, updatedAt: true, url: true },
      });
      if (
        existing &&
        (existing.clientRev > row.clientRev ||
          (existing.clientRev === row.clientRev &&
            existing.updatedAt > new Date(row.updatedAt)))
      ) {
        continue;
      }

      const url = row.url || existing?.url || "";
      await tx.photo.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          inspectionId: row.inspectionId,
          inspectionItemId: row.inspectionItemId ?? null,
          url,
          caption: row.caption,
          exifData: row.exifData as Prisma.InputJsonValue | undefined,
          annotations: row.annotations as Prisma.InputJsonValue,
          capturedAt: new Date(row.capturedAt),
          captureDate: new Date(row.capturedAt),
          clientRev: row.clientRev,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        },
        update: {
          url,
          caption: row.caption,
          exifData: row.exifData as Prisma.InputJsonValue | undefined,
          annotations: row.annotations as Prisma.InputJsonValue,
          capturedAt: new Date(row.capturedAt),
          clientRev: row.clientRev,
          updatedAt: new Date(row.updatedAt),
        },
      });
    }
  });

  return NextResponse.json({ ok: true, syncedAt: new Date().toISOString() });
}
