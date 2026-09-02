import {
  defaultSkippedCoverages,
  indicatorsForPeril,
  type IndicatorDef,
  type Confidence,
  type LossType,
  type Presence,
  type Severity,
} from "@/lib/inspection/indicators";
import { newId } from "@/lib/inspection/ids";
import { getDb } from "./db";
import type {
  CachedClaim,
  LocalInspection,
  LocalItem,
  LocalPhoto,
  OutboxEntry,
  OutboxOp,
  PhotoAnnotation,
  PhotoExif,
  AiDraft,
  ReferenceMatch,
} from "./types";
import type { InspectionReason } from "@/lib/inspection/catalog";

function nowIso() {
  return new Date().toISOString();
}

async function enqueue(op: OutboxOp, entityId: string) {
  const db = getDb();
  const existing = await db.outbox
    .where("entityId")
    .equals(entityId)
    .and((row) => row.op === op)
    .first();
  if (existing) return;
  const entry: OutboxEntry = {
    id: newId(),
    op,
    entityId,
    createdAt: nowIso(),
    attempts: 0,
    lastError: null,
  };
  await db.outbox.add(entry);
}

function localItemFromDef(
  inspectionId: string,
  def: IndicatorDef,
  sortOrder: number,
  ts: string
): LocalItem {
  return {
    id: newId(),
    inspectionId,
    category: def.category,
    indicatorType: def.type,
    presence: "UNSET",
    severity: null,
    confidence: null,
    notes: null,
    measurementValue: null,
    measurementUnit: def.unit ?? null,
    gpsLat: null,
    gpsLng: null,
    capturedAt: null,
    sortOrder,
    aiSuggestedCategory: null,
    aiSuggestedIndicator: null,
    aiConfidence: null,
    aiEstimatedSeverity: null,
    aiRationale: null,
    similarReferenceIds: [],
    adjusterConfirmed: false,
    adjusterFinalCategory: null,
    clientRev: 1,
    dirty: true,
    createdAt: ts,
    updatedAt: ts,
  };
}

export async function cacheClaim(claim: CachedClaim) {
  await getDb().claims.put(claim);
}

export async function getCachedClaimByNumber(claimNumber: string) {
  const normalized = claimNumber.trim().toUpperCase();
  return getDb().claims.where("claimNumber").equals(normalized).first();
}

export async function listCachedClaims() {
  return getDb().claims.orderBy("claimNumber").toArray();
}

export async function listCachedAssignedClaims(adjusterId: string) {
  const rows = await getDb().claims.toArray();
  return rows
    .filter((row) => row.assignedAdjusterId === adjusterId)
    .sort((a, b) => a.claimNumber.localeCompare(b.claimNumber));
}

export async function findOpenInspectionForClaim(
  claimId: string,
  adjusterId: string
) {
  const rows = await getDb().inspections.where("claimId").equals(claimId).toArray();
  return (
    rows
      .filter(
        (row) => row.adjusterId === adjusterId && row.status === "IN_PROGRESS"
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  );
}

export async function startLocalInspection(opts: {
  claim: CachedClaim;
  adjusterId: string;
  adjusterName: string;
  peril: LossType;
}): Promise<LocalInspection> {
  const db = getDb();
  const ts = nowIso();
  const inspection: LocalInspection = {
    id: newId(),
    claimId: opts.claim.id,
    claimNumber: opts.claim.claimNumber,
    propertyId: opts.claim.propertyId,
    propertyAddress: opts.claim.propertyAddress,
    zipCode: opts.claim.zipCode,
    county: opts.claim.county,
    adjusterId: opts.adjusterId,
    adjusterName: opts.adjusterName,
    perilTemplate: opts.peril,
    status: "IN_PROGRESS",
    startedAt: ts,
    completedAt: null,
    narrativeDraft: null,
    narrativeFinal: null,
    sessionId: null,
    customLocations: [],
    skippedCoverages: defaultSkippedCoverages(),
    skippedSystems: [],
    clientRev: 1,
    dirty: true,
    syncedAt: null,
    createdAt: ts,
    updatedAt: ts,
  };

  const defs = indicatorsForPeril(opts.peril);
  const items: LocalItem[] = defs.map((def, index) =>
    localItemFromDef(inspection.id, def, index, ts)
  );

  await db.transaction("rw", db.inspections, db.items, db.outbox, async () => {
    await db.inspections.put(inspection);
    await db.items.bulkPut(items);
    await enqueue("upsert-inspection", inspection.id);
    for (const item of items) {
      await enqueue("upsert-item", item.id);
    }
  });

  return inspection;
}

export async function markItemsNotPresent(ids: string[]) {
  const db = getDb();
  const ts = nowIso();
  await db.transaction("rw", db.items, db.outbox, async () => {
    for (const id of ids) {
      const current = await db.items.get(id);
      if (!current || current.presence !== "UNSET") continue;
      await db.items.put({
        ...current,
        presence: "NOT_PRESENT",
        severity: null,
        confidence: null,
        clientRev: current.clientRev + 1,
        dirty: true,
        updatedAt: ts,
      });
      await enqueue("upsert-item", id);
    }
  });
}

export async function ensureChecklistItems(
  inspectionId: string,
  peril: LossType
) {
  const db = getDb();
  const existing = await db.items.where("inspectionId").equals(inspectionId).toArray();
  const have = new Set(existing.map((row) => row.indicatorType));
  const missing = indicatorsForPeril(peril).filter((def) => !have.has(def.type));
  if (!missing.length) return;
  const ts = nowIso();
  const maxSort = existing.reduce((n, row) => Math.max(n, row.sortOrder), -1);
  const items = missing.map((def, index) =>
    localItemFromDef(inspectionId, def, maxSort + 1 + index, ts)
  );
  await db.transaction("rw", db.items, db.outbox, async () => {
    await db.items.bulkPut(items);
    for (const item of items) {
      await enqueue("upsert-item", item.id);
    }
  });
}

export async function listLocalInspections() {
  return getDb().inspections.orderBy("updatedAt").reverse().toArray();
}

export async function getLocalInspection(id: string) {
  return getDb().inspections.get(id);
}

export async function getInspectionItems(inspectionId: string) {
  return getDb()
    .items.where("inspectionId")
    .equals(inspectionId)
    .sortBy("sortOrder");
}

export async function getItemPhotos(inspectionItemId: string) {
  return getDb()
    .photos.where("inspectionItemId")
    .equals(inspectionItemId)
    .toArray();
}

export async function getInspectionPhotos(inspectionId: string) {
  return getDb().photos.where("inspectionId").equals(inspectionId).toArray();
}

export async function patchInspection(
  id: string,
  patch: Partial<
    Pick<
      LocalInspection,
      | "status"
      | "completedAt"
      | "narrativeDraft"
      | "narrativeFinal"
      | "propertyId"
      | "skippedCoverages"
      | "skippedSystems"
    >
  >
) {
  const db = getDb();
  const current = await db.inspections.get(id);
  if (!current) throw new Error("Inspection not found locally");
  const next: LocalInspection = {
    ...current,
    ...patch,
    clientRev: current.clientRev + 1,
    dirty: true,
    updatedAt: nowIso(),
  };
  await db.inspections.put(next);
  await enqueue("upsert-inspection", id);
  return next;
}

export async function patchItem(
  id: string,
  patch: Partial<
    Pick<
      LocalItem,
      | "presence"
      | "severity"
      | "confidence"
      | "notes"
      | "measurementValue"
      | "measurementUnit"
      | "gpsLat"
      | "gpsLng"
      | "capturedAt"
      | "aiSuggestedCategory"
      | "aiSuggestedIndicator"
      | "aiConfidence"
      | "aiEstimatedSeverity"
      | "aiRationale"
      | "similarReferenceIds"
      | "adjusterConfirmed"
      | "adjusterFinalCategory"
    >
  >
) {
  const db = getDb();
  const current = await db.items.get(id);
  if (!current) throw new Error("Item not found locally");
  const next: LocalItem = {
    ...current,
    ...patch,
    clientRev: current.clientRev + 1,
    dirty: true,
    updatedAt: nowIso(),
  };
  if (patch.presence === "PRESENT" && patch.adjusterConfirmed === undefined) {
    next.adjusterConfirmed = true;
    next.adjusterFinalCategory = next.category;
  }
  await db.items.put(next);
  await enqueue("upsert-item", id);

  const inspection = await db.inspections.get(current.inspectionId);
  if (inspection) {
    await db.inspections.put({
      ...inspection,
      clientRev: inspection.clientRev + 1,
      dirty: true,
      updatedAt: nowIso(),
    });
    await enqueue("upsert-inspection", inspection.id);
  }
  return next;
}

export async function queueCapturedPhoto(opts: {
  inspectionId: string;
  blob: Blob;
  captureDate: string;
  reason: InspectionReason;
  customReasonText?: string | null;
  locationTag: string;
  annotations?: PhotoAnnotation[];
  exifData?: PhotoExif | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  capturedAt?: string;
  inspectionItemId?: string | null;
}): Promise<LocalPhoto> {
  const db = getDb();
  const ts = opts.capturedAt ?? nowIso();
  const photo: LocalPhoto = {
    id: newId(),
    inspectionItemId: opts.inspectionItemId ?? null,
    inspectionId: opts.inspectionId,
    sessionId: null,
    url: "",
    storagePath: null,
    locationTag: opts.locationTag,
    captureDate: opts.captureDate,
    reason: opts.reason,
    customReasonText: opts.customReasonText ?? null,
    aiDescription: null,
    adjusterEditedDescription: null,
    gpsLat: opts.gpsLat ?? null,
    gpsLng: opts.gpsLng ?? null,
    syncStatus: "PENDING",
    analysis: null,
    references: [],
    caption: null,
    exifData: opts.exifData ?? null,
    annotations: opts.annotations ?? [],
    blob: opts.blob,
    capturedAt: ts,
    clientRev: 1,
    dirty: true,
    uploadPending: true,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.photos.put(photo);
  await enqueue("analyze-photo", photo.id);
  await enqueue("commit-photo", photo.id);
  await rememberCustomLocation(opts.inspectionId, opts.locationTag);
  return photo;
}

export async function rememberCustomLocation(
  inspectionId: string,
  location: string
) {
  const db = getDb();
  const row = await db.inspections.get(inspectionId);
  if (!row) return;
  if (row.customLocations.includes(location)) return;
  await db.inspections.put({
    ...row,
    customLocations: [...row.customLocations, location],
    updatedAt: nowIso(),
  });
}

export async function savePhotoAnalysis(
  id: string,
  analysis: AiDraft,
  references: ReferenceMatch[]
) {
  const db = getDb();
  const row = await db.photos.get(id);
  if (!row) return;
  await db.photos.put({
    ...row,
    analysis,
    references,
    aiDescription: analysis.visualRationale,
    syncStatus: row.syncStatus === "SYNCED" ? "SYNCED" : "ANALYZED",
    updatedAt: nowIso(),
  });
}

export async function patchPhoto(
  id: string,
  patch: Partial<LocalPhoto>
) {
  const db = getDb();
  const row = await db.photos.get(id);
  if (!row) throw new Error("Photo not found locally");
  await db.photos.put({
    ...row,
    ...patch,
    clientRev: row.clientRev + 1,
    dirty: true,
    updatedAt: nowIso(),
  });
}

export async function listPendingPhotos() {
  return getDb()
    .photos.filter((p) => p.syncStatus !== "SYNCED" && !!p.blob)
    .toArray();
}

export async function addPhoto(opts: {
  inspectionId: string;
  inspectionItemId: string;
  blob: Blob;
  caption?: string | null;
  annotations?: PhotoAnnotation[];
  exifData?: PhotoExif | null;
  capturedAt?: string;
}): Promise<LocalPhoto> {
  return queueCapturedPhoto({
    ...opts,
    captureDate: (opts.capturedAt ?? nowIso()).slice(0, 10),
    reason: "INITIAL_INSPECTION",
    locationTag: "Unspecified",
  });
}

export async function deleteLocalPhoto(id: string) {
  const db = getDb();
  await db.photos.delete(id);
  const leftover = await db.outbox.where("entityId").equals(id).toArray();
  await Promise.all(leftover.map((e) => db.outbox.delete(e.id)));
}

/** Remove a filed or pending photo locally and queue a vault delete. */
export async function removeInspectionPhoto(id: string) {
  const db = getDb();
  const leftover = await db.outbox.where("entityId").equals(id).toArray();
  await Promise.all(leftover.map((e) => db.outbox.delete(e.id)));
  await enqueue("delete-photo", id);
  await db.photos.delete(id);
}

export async function listPendingPhotoDeletes() {
  return getDb()
    .outbox.where("op")
    .equals("delete-photo")
    .toArray();
}

export async function pendingOutboxCount() {
  return getDb().outbox.count();
}

export async function listOutbox() {
  return getDb().outbox.orderBy("createdAt").toArray();
}

export async function bumpOutboxError(id: string, error: string) {
  const db = getDb();
  const row = await db.outbox.get(id);
  if (!row) return;
  await db.outbox.put({
    ...row,
    attempts: row.attempts + 1,
    lastError: error,
  });
}

export async function removeOutbox(id: string) {
  await getDb().outbox.delete(id);
}

export async function markInspectionClean(id: string, syncedAt: string) {
  const db = getDb();
  const row = await db.inspections.get(id);
  if (!row) return;
  await db.inspections.put({ ...row, dirty: false, syncedAt });
}

export async function markItemClean(id: string) {
  const db = getDb();
  const row = await db.items.get(id);
  if (!row) return;
  await db.items.put({ ...row, dirty: false });
}

export async function markPhotoUploaded(id: string, url: string) {
  const db = getDb();
  const row = await db.photos.get(id);
  if (!row) return;
  await db.photos.put({
    ...row,
    url,
    blob: null,
    uploadPending: false,
    dirty: true,
    clientRev: row.clientRev + 1,
    updatedAt: nowIso(),
  });
  await enqueue("upsert-photo-meta", id);
}

export async function markPhotoMetaClean(id: string) {
  const db = getDb();
  const row = await db.photos.get(id);
  if (!row) return;
  await db.photos.put({ ...row, dirty: false });
}

export function applyPresenceDefaults(
  presence: Presence,
  current: { severity: Severity | null; confidence: Confidence | null }
): { severity: Severity | null; confidence: Confidence | null } {
  if (presence !== "PRESENT") {
    return { severity: null, confidence: null };
  }
  return {
    severity: current.severity ?? "MODERATE",
    confidence: current.confidence ?? "CONFIRMED",
  };
}
