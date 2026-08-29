import { z } from "zod";

export const lossTypeEnum = z.enum([
  "WIND",
  "FIRE",
  "WATER",
  "HAIL",
  "VANDALISM",
  "OTHER",
]);

export const presenceEnum = z.enum(["UNSET", "PRESENT", "NOT_PRESENT"]);
export const severityEnum = z.enum(["MINOR", "MODERATE", "SEVERE", "CRITICAL"]);
export const confidenceEnum = z.enum(["CONFIRMED", "SUSPECTED"]);
export const categoryEnum = z.enum([
  "WATER",
  "STRUCTURAL",
  "ROOF",
  "INTERIOR",
  "MECHANICAL",
  "EXTERIOR",
  "MOLD",
  "OTHER_STRUCTURES",
  "CONTENTS",
  "ALE",
  "ADDITIONAL",
  "CAUSATION",
]);
export const inspectionStatusEnum = z.enum(["IN_PROGRESS", "COMPLETED"]);

export const lookupClaimSchema = z.object({
  claimNumber: z.string().min(3).max(32),
});

const optionalContact = z
  .string()
  .trim()
  .optional()
  .transform((v) => v ?? "");

export const fieldIntakeSchema = z.object({
  firstName: z.string().trim().min(1, "Client first name is required").max(80),
  lastName: z.string().trim().min(1, "Client last name is required").max(80),
  phone: optionalContact,
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => v ?? "")
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "Enter a valid email or leave blank",
    }),
  propertyAddress: z.string().trim().min(1, "Property address is required").max(200),
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP"),
  county: z.string().trim().min(1, "County is required").max(80),
  dateOfLoss: z.string().min(1, "Date of loss is required"),
  lossType: lossTypeEnum,
  isCatClaim: z.boolean().optional().default(false),
  lossDescription: optionalContact,
});

export const syncInspectionSchema = z.object({
  id: z.string().min(1),
  claimId: z.string().min(1),
  claimNumber: z.string().min(1),
  propertyId: z.string().min(1),
  propertyAddress: z.string(),
  zipCode: z.string(),
  county: z.string(),
  adjusterId: z.string().min(1),
  adjusterName: z.string(),
  perilTemplate: lossTypeEnum,
  status: inspectionStatusEnum,
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  narrativeDraft: z.string().nullable(),
  narrativeFinal: z.string().nullable(),
  clientRev: z.number().int(),
  syncedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const syncItemSchema = z.object({
  id: z.string().min(1),
  inspectionId: z.string().min(1),
  category: categoryEnum,
  indicatorType: z.string().min(1),
  presence: presenceEnum,
  severity: severityEnum.nullable(),
  confidence: confidenceEnum.nullable(),
  notes: z.string().nullable(),
  measurementValue: z.number().nullable(),
  measurementUnit: z.string().nullable(),
  gpsLat: z.number().nullable(),
  gpsLng: z.number().nullable(),
  capturedAt: z.string().nullable(),
  sortOrder: z.number().int(),
  clientRev: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  aiSuggestedCategory: categoryEnum.nullable().optional(),
  aiSuggestedIndicator: z.string().nullable().optional(),
  aiConfidence: confidenceEnum.nullable().optional(),
  aiEstimatedSeverity: severityEnum.nullable().optional(),
  aiRationale: z.string().nullable().optional(),
  similarReferenceIds: z.array(z.string()).optional(),
  adjusterConfirmed: z.boolean().optional(),
  adjusterFinalCategory: categoryEnum.nullable().optional(),
});

export const syncPhotoMetaSchema = z
  .object({
    id: z.string().min(1),
    inspectionItemId: z.string().nullable().optional(),
    inspectionId: z.string().min(1),
    url: z.string(),
    caption: z.string().nullable(),
    exifData: z.unknown().nullable(),
    annotations: z.array(z.unknown()),
    capturedAt: z.string(),
    clientRev: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const syncPushSchema = z.object({
  inspections: z.array(syncInspectionSchema),
  items: z.array(syncItemSchema),
  photos: z.array(syncPhotoMetaSchema),
});
