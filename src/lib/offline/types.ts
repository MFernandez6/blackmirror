import type {
  Confidence,
  CoverageTabId,
  InspectionCategory,
  LossType,
  Presence,
  Severity,
} from "@/lib/inspection/indicators";
import type { InspectionReason } from "@/lib/inspection/catalog";

export type LocalInspectionStatus = "IN_PROGRESS" | "COMPLETED";
export type PhotoSyncStatus = "PENDING" | "ANALYZED" | "SYNCED";

export type LocalInspection = {
  id: string;
  claimId: string;
  claimNumber: string;
  propertyId: string;
  propertyAddress: string;
  zipCode: string;
  county: string;
  adjusterId: string;
  adjusterName: string;
  perilTemplate: LossType;
  status: LocalInspectionStatus;
  startedAt: string;
  completedAt: string | null;
  narrativeDraft: string | null;
  narrativeFinal: string | null;
  sessionId: string | null;
  customLocations: string[];
  skippedCoverages?: CoverageTabId[];
  skippedSystems?: InspectionCategory[];
  clientRev: number;
  dirty: boolean;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiDraft = {
  category: InspectionCategory;
  indicatorType: string;
  confidence: Confidence;
  estimatedSeverity: Severity;
  visualRationale: string;
};

export type ReferenceMatch = {
  id: string;
  category: InspectionCategory;
  indicatorType: string;
  imageUrl: string;
  description: string;
  sourceNote: string;
  similarity: number;
};

export type LocalItem = {
  id: string;
  inspectionId: string;
  category: InspectionCategory;
  indicatorType: string;
  presence: Presence;
  severity: Severity | null;
  confidence: Confidence | null;
  notes: string | null;
  measurementValue: number | null;
  measurementUnit: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  capturedAt: string | null;
  sortOrder: number;
  aiSuggestedCategory: InspectionCategory | null;
  aiSuggestedIndicator: string | null;
  aiConfidence: Confidence | null;
  aiEstimatedSeverity: Severity | null;
  aiRationale: string | null;
  similarReferenceIds: string[];
  adjusterConfirmed: boolean;
  adjusterFinalCategory: InspectionCategory | null;
  clientRev: number;
  dirty: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PhotoAnnotation = {
  tool: "circle" | "arrow";
  color: string;
  points: number[][];
};

export type PhotoExif = {
  DateTimeOriginal?: string;
  GPSLatitude?: number;
  GPSLongitude?: number;
  Make?: string;
  Model?: string;
  stamped: boolean;
};

export type LocalPhoto = {
  id: string;
  inspectionItemId: string | null;
  inspectionId: string;
  sessionId: string | null;
  url: string;
  storagePath: string | null;
  locationTag: string | null;
  captureDate: string;
  reason: InspectionReason;
  customReasonText: string | null;
  aiDescription: string | null;
  adjusterEditedDescription: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  syncStatus: PhotoSyncStatus;
  analysis: AiDraft | null;
  references: ReferenceMatch[];
  caption: string | null;
  exifData: PhotoExif | null;
  annotations: PhotoAnnotation[];
  blob: Blob | null;
  capturedAt: string;
  clientRev: number;
  dirty: boolean;
  uploadPending: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CachedClaimStatus =
  | "INTAKE"
  | "UNDER_REVIEW"
  | "INVESTIGATION"
  | "FILED"
  | "NEGOTIATING"
  | "SETTLED"
  | "CLOSED"
  | "DENIED";

export type CachedClaim = {
  id: string;
  claimNumber: string;
  lossType: LossType;
  status: CachedClaimStatus;
  dateOfLoss: string | null;
  propertyId: string;
  propertyAddress: string;
  zipCode: string;
  county: string;
  assignedAdjusterId: string | null;
  assignedAdjusterName: string | null;
  primaryClaimant: string | null;
  latestInspectionId: string | null;
  latestInspectionStatus: LocalInspectionStatus | null;
  cachedAt: string;
};

export type OutboxOp =
  | "upsert-inspection"
  | "upsert-item"
  | "upsert-photo-meta"
  | "upload-photo"
  | "analyze-photo"
  | "commit-photo"
  | "delete-photo";

export type OutboxEntry = {
  id: string;
  op: OutboxOp;
  entityId: string;
  createdAt: string;
  attempts: number;
  lastError: string | null;
};

export type SyncInspectionPayload = Omit<LocalInspection, "dirty">;
export type SyncItemPayload = Omit<LocalItem, "dirty">;
export type SyncPhotoMetaPayload = Omit<
  LocalPhoto,
  "dirty" | "blob" | "uploadPending" | "analysis" | "references"
>;

export type SyncPushBody = {
  inspections: SyncInspectionPayload[];
  items: SyncItemPayload[];
  photos: SyncPhotoMetaPayload[];
};

export type SyncPullResult = {
  inspections: SyncInspectionPayload[];
  items: SyncItemPayload[];
  photos: SyncPhotoMetaPayload[];
};
