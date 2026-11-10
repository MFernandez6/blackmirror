import { getDb } from "./db";
import {
  bumpOutboxError,
  listOutbox,
  listPendingPhotoDeletes,
  listPendingPhotos,
  markInspectionClean,
  markItemClean,
  markPhotoMetaClean,
  patchPhoto,
  pendingOutboxCount,
  removeOutbox,
  savePhotoAnalysis,
  settleOutbox,
  getLocalInspection,
} from "./repo";
import { formatDefenseDraft } from "@/lib/ai/format-defense-draft";
import { analysisImage } from "@/lib/inspection/capture";
import type {
  AiDraft,
  CachedClaim,
  LocalInspection,
  LocalItem,
  LocalPhoto,
  ReferenceMatch,
  SyncPhotoMetaPayload,
  SyncPullResult,
  SyncPushBody,
} from "./types";

export type SyncStatus = {
  online: boolean;
  syncing: boolean;
  pending: number;
  lastError: string | null;
  lastSyncedAt: string | null;
};

type Listener = (status: SyncStatus) => void;

const listeners = new Set<Listener>();
let syncing = false;
let syncQueued = false;
let lastError: string | null = null;
let lastSyncedAt: string | null = null;
let started = false;

function omitLocal<T extends { dirty: boolean }>(row: T): Omit<T, "dirty"> {
  const { dirty: _dirty, ...rest } = row;
  return rest;
}

export async function getSyncSnapshot(): Promise<SyncStatus> {
  const pending =
    typeof window === "undefined" ? 0 : await pendingOutboxCount();
  return {
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    syncing,
    pending,
    lastError,
    lastSyncedAt,
  };
}

export function subscribeSync(listener: Listener) {
  listeners.add(listener);
  void getSyncSnapshot().then(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function emit() {
  const snap = await getSyncSnapshot();
  listeners.forEach((fn) => fn(snap));
}

async function processPhotoDeletes(): Promise<void> {
  const pending = await listPendingPhotoDeletes();
  for (const entry of pending) {
    const res = await fetch(`/api/inspections/photos/${entry.entityId}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Photo delete failed (${res.status}): ${text}`);
    }
    await removeOutbox(entry.id);
  }
}

async function pushDirty(): Promise<void> {
  const db = getDb();
  const inspections = await db.inspections.filter((r) => r.dirty).toArray();
  const items = await db.items.filter((r) => r.dirty).toArray();
  const photos = await db.photos
    .filter((r) => r.dirty && r.syncStatus === "SYNCED")
    .toArray();

  if (!inspections.length && !items.length && !photos.length) return;

  const body: SyncPushBody = {
    inspections: inspections.map((r) => omitLocal(r)),
    items: items.map((r) => omitLocal(r)),
    photos: photos.map((r) => {
      const {
        dirty: _d,
        blob: _b,
        uploadPending: _u,
        analysis: _a,
        references: _r,
        ...meta
      } = r;
      return meta;
    }),
  };

  const res = await fetch("/api/inspections/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Sync push failed (${res.status}): ${text}`);
  }

  const ts = new Date().toISOString();
  await Promise.all(inspections.map((r) => markInspectionClean(r.id, ts, r.clientRev)));
  await Promise.all(items.map((r) => markItemClean(r.id, r.clientRev)));
  await Promise.all(photos.map((r) => markPhotoMetaClean(r.id, r.clientRev)));
}

/** Thrown by analysis when the server has no AI available; the photo is filed unclassified instead. */
class AiUnavailableError extends Error {}

async function analyzeQueuedPhoto(photo: LocalPhoto): Promise<void> {
  const form = new FormData();
  form.set("file", await analysisImage(photo.blob!), `${photo.id}.jpg`);
  const parent = await getLocalInspection(photo.inspectionId);
  if (parent?.perilTemplate) form.set("peril", parent.perilTemplate);
  const res = await fetch("/api/analyze-photo", { method: "POST", body: form });
  if (res.status === 503) throw new AiUnavailableError();
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Photo analysis failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    analysis: AiDraft;
    references: ReferenceMatch[];
  };
  await savePhotoAnalysis(photo.id, data.analysis, data.references);
}

async function commitQueuedPhoto(photo: LocalPhoto): Promise<void> {
  const analysis = photo.analysis;
  // Without an AI draft the photo files under the checklist item it was taken for, unconfirmed.
  const itemIndicator = photo.inspectionItemId
    ? (await getDb().items.get(photo.inspectionItemId))?.indicatorType
    : undefined;
  const indicatorType = analysis?.indicatorType ?? itemIndicator;
  if (!indicatorType) return;

  const commit = new FormData();
  commit.set("id", photo.id);
  commit.set("inspectionId", photo.inspectionId);
  if (photo.inspectionItemId) commit.set("inspectionItemId", photo.inspectionItemId);
  if (photo.sessionId) commit.set("sessionId", photo.sessionId);
  commit.set("locationTag", photo.locationTag ?? "Unspecified");
  commit.set("captureDate", photo.captureDate);
  commit.set("reason", photo.reason);
  if (photo.customReasonText) commit.set("customReasonText", photo.customReasonText);
  commit.set(
    "description",
    photo.adjusterEditedDescription || (analysis ? formatDefenseDraft(analysis) : "")
  );
  commit.set("adjusterConfirmed", "false");
  commit.set("indicatorType", indicatorType);
  if (analysis) {
    commit.set("category", analysis.category);
    commit.set("severity", analysis.estimatedSeverity);
    commit.set("confidence", analysis.confidence);
    commit.set("aiRationale", formatDefenseDraft(analysis));
    commit.set("aiSuggestedIndicator", analysis.indicatorType);
  }
  commit.set(
    "similarReferenceIds",
    JSON.stringify(photo.references.map((r) => r.id))
  );
  if (photo.gpsLat != null) commit.set("gpsLat", String(photo.gpsLat));
  if (photo.gpsLng != null) commit.set("gpsLng", String(photo.gpsLng));
  const parent = await getLocalInspection(photo.inspectionId);
  if (parent) commit.set("claimId", parent.claimId);
  commit.set("file", photo.blob!, `${photo.id}.jpg`);

  const committed = await fetch("/api/inspections/commit-photo", {
    method: "POST",
    body: commit,
  });
  if (!committed.ok) {
    const text = await committed.text().catch(() => committed.statusText);
    throw new Error(`Vault commit failed (${committed.status}): ${text}`);
  }
  const result = (await committed.json()) as {
    url: string;
    storagePath: string;
    itemId: string;
    sessionId: string;
  };
  await patchPhoto(photo.id, {
    url: result.url,
    storagePath: result.storagePath,
    inspectionItemId: result.itemId,
    sessionId: result.sessionId,
    blob: null,
    uploadPending: false,
    syncStatus: "SYNCED",
    dirty: false,
  });
}

/** Files each queued photo independently so one failure does not hold back the rest. */
async function processCaptureQueue(): Promise<string | null> {
  let firstError: string | null = null;
  for (const photo of await listPendingPhotos()) {
    if (!photo.blob) continue;
    try {
      if (!photo.analysis) {
        try {
          await analyzeQueuedPhoto(photo);
        } catch (err) {
          if (!(err instanceof AiUnavailableError)) throw err;
        }
      }
      const fresh = (await getDb().photos.get(photo.id)) ?? photo;
      await commitQueuedPhoto(fresh);
    } catch (err) {
      firstError ??= err instanceof Error ? err.message : "Photo filing failed";
    }
  }
  return firstError;
}

function mergeByRev<T extends { id: string; clientRev: number; updatedAt: string }>(
  local: T,
  remote: T
): T {
  if (remote.clientRev > local.clientRev) return remote;
  if (remote.clientRev < local.clientRev) return local;
  return new Date(remote.updatedAt) > new Date(local.updatedAt) ? remote : local;
}

async function pullRemote(): Promise<void> {
  const res = await fetch("/api/inspections/sync", { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Sync pull failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as SyncPullResult & { claims?: CachedClaim[] };
  const db = getDb();
  const pendingDeletes = new Set(
    (await listPendingPhotoDeletes()).map((row) => row.entityId)
  );

  await db.transaction(
    "rw",
    db.inspections,
    db.items,
    db.photos,
    db.claims,
    async () => {
      if (data.claims) {
        for (const claim of data.claims) {
          await db.claims.put(claim);
        }
      }

      for (const remote of data.inspections) {
        const local = await db.inspections.get(remote.id);
        if (!local) {
          await db.inspections.put({
            ...remote,
            sessionId: remote.sessionId ?? null,
            customLocations: remote.customLocations ?? [],
            skippedCoverages: remote.skippedCoverages ?? [],
            skippedSystems: remote.skippedSystems ?? [],
            dirty: false,
          });
          continue;
        }
        if (local.dirty) {
          const winner = mergeByRev(local, { ...local, ...remote, dirty: local.dirty });
          await db.inspections.put({
            ...winner,
            skippedCoverages:
              winner.skippedCoverages ?? local.skippedCoverages ?? [],
            skippedSystems: winner.skippedSystems ?? local.skippedSystems ?? [],
            dirty: winner.clientRev > remote.clientRev,
          });
        } else {
          await db.inspections.put({
            ...remote,
            sessionId: remote.sessionId ?? local.sessionId ?? null,
            customLocations: remote.customLocations ?? local.customLocations ?? [],
            skippedCoverages:
              remote.skippedCoverages ?? local.skippedCoverages ?? [],
            skippedSystems: remote.skippedSystems ?? local.skippedSystems ?? [],
            dirty: false,
          });
        }
      }

      for (const remote of data.items) {
        const local = await db.items.get(remote.id);
        if (!local) {
          await db.items.put({
            ...remote,
            similarReferenceIds: remote.similarReferenceIds ?? [],
            adjusterConfirmed: remote.adjusterConfirmed ?? false,
            dirty: false,
          });
          continue;
        }
        if (local.dirty) continue;
        await db.items.put({ ...remote, dirty: false });
      }

      for (const remote of data.photos) {
        if (pendingDeletes.has(remote.id)) continue;
        const local = await db.photos.get(remote.id);
        if (!local) {
          await db.photos.put({
            ...remote,
            blob: null,
            dirty: false,
            uploadPending: false,
            analysis: null,
            references: [],
            sessionId: remote.sessionId ?? null,
            syncStatus: remote.syncStatus ?? "SYNCED",
          } as LocalPhoto);
          continue;
        }
        if (local.dirty || local.uploadPending) continue;
        await db.photos.put({
          ...local,
          ...remote,
          blob: local.blob,
          dirty: false,
          uploadPending: false,
        });
      }
    }
  );
}

export async function runSync(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!navigator.onLine) {
    await emit();
    return;
  }
  if (syncing) {
    syncQueued = true;
    return;
  }
  syncing = true;
  lastError = null;
  await emit();
  try {
    await processPhotoDeletes();
    await pushDirty();
    const captureError = await processCaptureQueue();
    await pullRemote();
    await settleOutbox();
    if (captureError) throw new Error(captureError);
    lastSyncedAt = new Date().toISOString();
  } catch (err) {
    lastError = err instanceof Error ? err.message : "Sync failed";
    await settleOutbox().catch(() => undefined);
    const leftover = await listOutbox();
    for (const entry of leftover) {
      await bumpOutboxError(entry.id, lastError);
    }
  } finally {
    syncing = false;
    await emit();
    if (syncQueued) {
      syncQueued = false;
      void runSync();
    }
  }
}

export function startSyncLoop() {
  if (typeof window === "undefined" || started) return;
  started = true;
  const tick = () => {
    void runSync();
  };
  window.addEventListener("online", tick);
  window.addEventListener("offline", () => {
    void emit();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tick();
  });
  tick();
  window.setInterval(() => {
    if (navigator.onLine) tick();
  }, 20_000);
}

export type { LocalInspection, LocalItem, SyncPhotoMetaPayload };
