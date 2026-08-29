import Dexie, { type Table } from "dexie";
import type {
  CachedClaim,
  LocalInspection,
  LocalItem,
  LocalPhoto,
  OutboxEntry,
} from "./types";

class InspectionDatabase extends Dexie {
  inspections!: Table<LocalInspection, string>;
  items!: Table<LocalItem, string>;
  photos!: Table<LocalPhoto, string>;
  claims!: Table<CachedClaim, string>;
  outbox!: Table<OutboxEntry, string>;

  constructor() {
    super("blackmirror-inspections");
    this.version(1).stores({
      inspections: "id, claimId, claimNumber, status, updatedAt, dirty",
      items: "id, inspectionId, category, indicatorType, dirty, updatedAt",
      photos: "id, inspectionItemId, inspectionId, dirty, uploadPending",
      claims: "id, claimNumber",
      outbox: "id, op, entityId, createdAt",
    });
    this.version(2)
      .stores({
        inspections: "id, claimId, claimNumber, status, updatedAt, dirty",
        items: "id, inspectionId, category, indicatorType, dirty, updatedAt, adjusterConfirmed",
        photos: "id, inspectionItemId, inspectionId, syncStatus, dirty, uploadPending",
        claims: "id, claimNumber",
        outbox: "id, op, entityId, createdAt",
      })
      .upgrade(async (tx) => {
        await tx.table("inspections").toCollection().modify((row: LocalInspection) => {
          row.sessionId = row.sessionId ?? null;
          row.customLocations = row.customLocations ?? [];
        });
        await tx.table("items").toCollection().modify((row: LocalItem) => {
          row.adjusterConfirmed = row.adjusterConfirmed ?? false;
          row.similarReferenceIds = row.similarReferenceIds ?? [];
          row.aiSuggestedCategory = row.aiSuggestedCategory ?? null;
          row.aiSuggestedIndicator = row.aiSuggestedIndicator ?? null;
          row.aiConfidence = row.aiConfidence ?? null;
          row.aiEstimatedSeverity = row.aiEstimatedSeverity ?? null;
          row.aiRationale = row.aiRationale ?? null;
          row.adjusterFinalCategory = row.adjusterFinalCategory ?? null;
        });
        await tx.table("photos").toCollection().modify((row: LocalPhoto) => {
          row.inspectionItemId = row.inspectionItemId ?? null;
          row.sessionId = row.sessionId ?? null;
          row.syncStatus = row.syncStatus ?? (row.uploadPending ? "PENDING" : "SYNCED");
          row.locationTag = row.locationTag ?? null;
          row.captureDate = row.captureDate ?? (row.capturedAt || "").slice(0, 10);
          row.reason = row.reason ?? "INITIAL_INSPECTION";
          row.customReasonText = row.customReasonText ?? null;
          row.analysis = row.analysis ?? null;
          row.references = row.references ?? [];
        });
      });
    this.version(3).upgrade(async (tx) => {
      await tx.table("inspections").toCollection().modify((row: LocalInspection) => {
        row.skippedCoverages = row.skippedCoverages ?? [];
        row.skippedSystems = row.skippedSystems ?? [];
      });
    });
  }
}

let db: InspectionDatabase | null = null;

export function getDb(): InspectionDatabase {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  if (!db) db = new InspectionDatabase();
  return db;
}
