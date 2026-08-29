import { NextResponse } from "next/server";
import type { Prisma, Severity, Confidence } from "@prisma/client";
import { canEdit, getSession, resolveSessionAdjuster } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storeVaultPhoto } from "@/lib/storage";
import { INDICATOR_BY_TYPE } from "@/lib/inspection/indicators";
import {
  displayVaultPath,
  vaultPhotoPath,
  type InspectionReason,
} from "@/lib/inspection/catalog";
import { newId } from "@/lib/inspection/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();
  const adjuster = session ? await resolveSessionAdjuster(session) : null;
  if (!adjuster) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!canEdit(adjuster.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const photoId = String(form.get("id") ?? newId());
  const inspectionId = String(form.get("inspectionId") ?? "");
  const inspectionItemIdRaw = String(form.get("inspectionItemId") ?? "");
  const locationTag = String(form.get("locationTag") ?? "").trim();
  const captureDate = String(form.get("captureDate") ?? "").slice(0, 10);
  const reason = String(form.get("reason") ?? "INITIAL_INSPECTION") as InspectionReason;
  const customReasonText = String(form.get("customReasonText") ?? "") || null;
  const description = String(form.get("description") ?? "").trim();
  const confirm = String(form.get("adjusterConfirmed") ?? "") === "true";
  const indicatorType = String(form.get("indicatorType") ?? "");
  const categoryRaw = String(form.get("category") ?? "");
  const severity = String(form.get("severity") ?? "") || null;
  const confidence = String(form.get("confidence") ?? "") || null;
  const aiRationale = String(form.get("aiRationale") ?? "") || null;
  const aiSuggestedIndicator = String(form.get("aiSuggestedIndicator") ?? "") || null;
  const similarRaw = String(form.get("similarReferenceIds") ?? "[]");
  const gpsLat = form.get("gpsLat") ? Number(form.get("gpsLat")) : null;
  const gpsLng = form.get("gpsLng") ? Number(form.get("gpsLng")) : null;
  const sessionId = String(form.get("sessionId") ?? "") || null;

  if (!(file instanceof File) || !inspectionId || !locationTag || !captureDate) {
    return NextResponse.json({ error: "INVALID_COMMIT" }, { status: 400 });
  }
  const def = INDICATOR_BY_TYPE[indicatorType];
  if (!def) {
    return NextResponse.json({ error: "UNKNOWN_INDICATOR" }, { status: 400 });
  }

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { claim: { select: { id: true, claimNumber: true } } },
  });
  if (!inspection) {
    return NextResponse.json({ error: "INSPECTION_NOT_FOUND" }, { status: 404 });
  }
  if (adjuster.role === "ADJUSTER" && inspection.adjusterId !== adjuster.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const capturedAt = new Date();
  const timeHms = [
    String(capturedAt.getHours()).padStart(2, "0"),
    String(capturedAt.getMinutes()).padStart(2, "0"),
    String(capturedAt.getSeconds()).padStart(2, "0"),
  ].join("");
  const storagePath = vaultPhotoPath({
    claimNumber: inspection.claim.claimNumber,
    date: captureDate,
    reason,
    customReason: customReasonText,
    location: locationTag,
    timeHms,
    description: description || def.label,
  });

  const bytes = Buffer.from(await file.arrayBuffer());
  const stored = await storeVaultPhoto({
    storagePath,
    bytes,
    mimeType: file.type || "image/jpeg",
  });

  let similarReferenceIds: string[] = [];
  try {
    similarReferenceIds = JSON.parse(similarRaw) as string[];
  } catch {
    similarReferenceIds = [];
  }

  const result = await prisma.$transaction(async (tx) => {
    let sessionRowId = sessionId;
    if (!sessionRowId) {
      const created = await tx.inspectionSession.create({
        data: {
          id: newId(),
          claimId: inspection.claimId,
          inspectionId,
          date: new Date(`${captureDate}T12:00:00.000Z`),
          reason,
          customReasonText,
          createdById: adjuster.id,
        },
      });
      sessionRowId = created.id;
    }

    let itemId = inspectionItemIdRaw || null;
    const existingItem = itemId
      ? await tx.inspectionItem.findUnique({ where: { id: itemId } })
      : await tx.inspectionItem.findUnique({
          where: {
            inspectionId_indicatorType: { inspectionId, indicatorType },
          },
        });

    const sev: Severity | null =
      severity === "MINOR" ||
      severity === "MODERATE" ||
      severity === "SEVERE" ||
      severity === "CRITICAL"
        ? severity
        : null;
    const conf: Confidence | null =
      confidence === "CONFIRMED" || confidence === "SUSPECTED" ? confidence : null;

    const itemData = {
      category: def.category,
      indicatorType: def.type,
      presence: "PRESENT" as const,
      severity: sev,
      confidence: conf,
      notes: description || null,
      gpsLat,
      gpsLng,
      capturedAt,
      aiSuggestedCategory: def.category,
      aiSuggestedIndicator: aiSuggestedIndicator || def.type,
      aiConfidence: conf,
      aiEstimatedSeverity: sev,
      aiRationale,
      similarReferenceIds: similarReferenceIds as Prisma.InputJsonValue,
      adjusterConfirmed: confirm,
      adjusterFinalCategory: confirm ? def.category : null,
    };

    if (existingItem) {
      itemId = existingItem.id;
      await tx.inspectionItem.update({
        where: { id: existingItem.id },
        data: {
          ...itemData,
          clientRev: { increment: 1 },
        },
      });
    } else {
      itemId = newId();
      await tx.inspectionItem.create({
        data: {
          id: itemId,
          inspectionId,
          sortOrder: 999,
          ...itemData,
        },
      });
    }

    await tx.photo.upsert({
      where: { id: photoId },
      create: {
        id: photoId,
        inspectionId,
        inspectionSessionId: sessionRowId,
        inspectionItemId: itemId,
        url: stored.fileUrl,
        storagePath: stored.storagePath,
        locationTag,
        captureDate: new Date(`${captureDate}T12:00:00.000Z`),
        reason,
        customReasonText,
        aiDescription: aiRationale,
        adjusterEditedDescription: description,
        gpsLat,
        gpsLng,
        syncStatus: "SYNCED",
        caption: description || def.label,
        capturedAt,
      },
      update: {
        inspectionSessionId: sessionRowId,
        inspectionItemId: itemId,
        url: stored.fileUrl,
        storagePath: stored.storagePath,
        locationTag,
        captureDate: new Date(`${captureDate}T12:00:00.000Z`),
        reason,
        customReasonText,
        aiDescription: aiRationale,
        adjusterEditedDescription: description,
        gpsLat,
        gpsLng,
        syncStatus: "SYNCED",
        caption: description || def.label,
      },
    });

    const document = await tx.document.create({
      data: {
        claimId: inspection.claimId,
        fileName: stored.storagePath.split("/").slice(-1)[0] ?? "photo.jpg",
        fileUrl: stored.fileUrl,
        fileSizeBytes: bytes.byteLength,
        mimeType: file.type || "image/jpeg",
        docType: "PHOTO",
        uploadedById: adjuster.id,
      },
    });

    const vault = await tx.documentVaultEntry.create({
      data: {
        claimId: inspection.claimId,
        photoId,
        documentId: document.id,
        displayPath: displayVaultPath(stored.storagePath),
        uploadedById: adjuster.id,
      },
    });

    await tx.claimAuditEvent.create({
      data: {
        claimId: inspection.claimId,
        actorId: adjuster.id,
        action: "INSPECTION_PHOTO_VAULT",
        entityType: "Photo",
        entityId: photoId,
        summary: `Filed inspection photo at ${displayVaultPath(stored.storagePath)}`,
        meta: {
          indicatorType,
          aiSuggestedIndicator,
          adjusterConfirmed: confirm,
          category: categoryRaw || def.category,
        },
      },
    });

    return { itemId, sessionId: sessionRowId, vaultId: vault.id, url: stored.fileUrl, storagePath: stored.storagePath };
  });

  return NextResponse.json({ ok: true, ...result });
}
