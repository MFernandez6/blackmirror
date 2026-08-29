import { getDb } from "./db";
import {
  bumpOutboxError,
  listOutbox,
  listPendingPhotos,
  markInspectionClean,
  markItemClean,
  markPhotoMetaClean,
  markPhotoUploaded,
  patchPhoto,
  pendingOutboxCount,
  removeOutbox,
  savePhotoAnalysis,
} from "./repo";
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
  await Promise.all(inspections.map((r) => markInspectionClean(r.id, ts)));
  await Promise.all(items.map((r) => markItemClean(r.id)));
  await Promise.all(photos.map((r) => markPhotoMetaClean(r.id)));
}

async function processCaptureQueue(): Promise<void> {
  const pending = await listPendingPhotos();
  for (const photo of pending) {
    if (!photo.blob) continue;

    if (!photo.analysis) {
      const form = new FormData();
      form.set("file", photo.blob, `${photo.id}.jpg`);
      const res = await fetch("/api/analyze-photo", { method: "POST", body: form });
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

    const fresh = (await getDb().photos.get(photo.id)) ?? photo;
    const analysis = fresh.analysis;
    if (!analysis) continue;

    const commit = new FormData();
    commit.set("id", fresh.id);
    commit.set("inspectionId", fresh.inspectionId);
    if (fresh.inspectionItemId) commit.set("inspectionItemId", fresh.inspectionItemId);
    if (fresh.sessionId) commit.set("sessionId", fresh.sessionId);
    commit.set("locationTag", fresh.locationTag ?? "Unspecified");
    commit.set("captureDate", fresh.captureDate);
    commit.set("reason", fresh.reason);
    if (fresh.customReasonText) commit.set("customReasonText", fresh.customReasonText);
    commit.set(
      "description",
      fresh.adjusterEditedDescription || analysis.visualRationale
    );
    commit.set("adjusterConfirmed", "false");
    commit.set("indicatorType", analysis.indicatorType);
    commit.set("category", analysis.category);
    commit.set("severity", analysis.estimatedSeverity);
    commit.set("confidence", analysis.confidence);
    commit.set("aiRationale", analysis.visualRationale);
    commit.set("aiSuggestedIndicator", analysis.indicatorType);
    commit.set(
      "similarReferenceIds",
      JSON.stringify(fresh.references.map((r) => r.id))
    );
    if (fresh.gpsLat != null) commit.set("gpsLat", String(fresh.gpsLat));
    if (fresh.gpsLng != null) commit.set("gpsLng", String(fresh.gpsLng));
    commit.set("file", fresh.blob!, `${fresh.id}.jpg`);

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
    await patchPhoto(fresh.id, {
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
  if (syncing) return;
  syncing = true;
  lastError = null;
  await emit();
  try {
    await processCaptureQueue();
    await pushDirty();
    await pullRemote();
    const leftover = await listOutbox();
    for (const entry of leftover) {
      await removeOutbox(entry.id);
    }
    lastSyncedAt = new Date().toISOString();
  } catch (err) {
    lastError = err instanceof Error ? err.message : "Sync failed";
    const leftover = await listOutbox();
    for (const entry of leftover) {
      await bumpOutboxError(entry.id, lastError);
    }
  } finally {
    syncing = false;
    await emit();
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
