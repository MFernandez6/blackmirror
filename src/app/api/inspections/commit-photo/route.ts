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
import { ensureInspectionRow } from "@/lib/inspection/serialize";

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
  const claimId = String(form.get("claimId") ?? "");

  if (!(file instanceof File) || !inspectionId || !locationTag || !captureDate) {
    return NextResponse.json({ error: "INVALID_COMMIT" }, { status: 400 });
  }
  const def = INDICATOR_BY_TYPE[indicatorType];
  if (!def) {
    return NextResponse.json({ error: "UNKNOWN_INDICATOR" }, { status: 400 });
  }

  const inspection =
    (await prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: { claim: { select: { id: true, claimNumber: true } } },
    })) ??
    (claimId
      ? await ensureInspectionRow({
          id: inspectionId,
          claimId,
          adjusterId: adjuster.id,
        })
      : null);
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
  let stored: { fileUrl: string; storagePath: string };
  try {
    stored = await storeVaultPhoto({
      storagePath,
      bytes,
      mimeType: file.type || "image/jpeg",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Storage upload failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  let similarReferenceIds: string[] = [];
  try {
    similarReferenceIds = JSON.parse(similarRaw) as string[];
  } catch {
    similarReferenceIds = [];
  }

  let result: {
    itemId: string;
    sessionId: string;
    vaultId: string;
    url: string;
    storagePath: string;
  };
  try {
    result = await prisma.$transaction(
    async (tx) => {
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

    const matchedItem = await tx.inspectionItem.findUnique({
      where: {
        inspectionId_indicatorType: { inspectionId, indicatorType: def.type },
      },
    });
    let itemId = matchedItem?.id ?? null;

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

    if (matchedItem) {
      await tx.inspectionItem.update({
        where: { id: matchedItem.id },
        data: {
          presence: itemData.presence,
          severity: itemData.severity,
          confidence: itemData.confidence,
          notes: itemData.notes,
          gpsLat: itemData.gpsLat,
          gpsLng: itemData.gpsLng,
          capturedAt: itemData.capturedAt,
          aiSuggestedCategory: itemData.aiSuggestedCategory,
          aiSuggestedIndicator: itemData.aiSuggestedIndicator,
          aiConfidence: itemData.aiConfidence,
          aiEstimatedSeverity: itemData.aiEstimatedSeverity,
          aiRationale: itemData.aiRationale,
          similarReferenceIds: itemData.similarReferenceIds,
          adjusterConfirmed: itemData.adjusterConfirmed,
          adjusterFinalCategory: itemData.adjusterFinalCategory,
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

    if (!itemId) {
      throw new Error("ITEM_ATTACH_FAILED");
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

    const fileName = stored.storagePath.split("/").slice(-1)[0] ?? "photo.jpg";
    const existingVault = await tx.documentVaultEntry.findUnique({
      where: { photoId },
    });
    let vault: { id: string };
    if (existingVault?.documentId) {
      await tx.document.update({
        where: { id: existingVault.documentId },
        data: {
          fileName,
          fileUrl: stored.fileUrl,
          fileSizeBytes: bytes.byteLength,
          mimeType: file.type || "image/jpeg",
        },
      });
      vault = await tx.documentVaultEntry.update({
        where: { id: existingVault.id },
        data: { displayPath: displayVaultPath(stored.storagePath) },
      });
    } else {
      const document = await tx.document.create({
        data: {
          claimId: inspection.claimId,
          fileName,
          fileUrl: stored.fileUrl,
          fileSizeBytes: bytes.byteLength,
          mimeType: file.type || "image/jpeg",
          docType: "PHOTO",
          uploadedById: adjuster.id,
        },
      });
      vault = await tx.documentVaultEntry.create({
        data: {
          claimId: inspection.claimId,
          photoId,
          documentId: document.id,
          displayPath: displayVaultPath(stored.storagePath),
          uploadedById: adjuster.id,
        },
      });
    }

    if (!existingVault?.documentId) {
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
    }

    return { itemId, sessionId: sessionRowId, vaultId: vault.id, url: stored.fileUrl, storagePath: stored.storagePath };
  },
    { timeout: 20_000, maxWait: 10_000 }
  );

  return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Vault write failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
