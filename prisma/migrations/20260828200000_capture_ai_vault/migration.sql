-- Capture → confirm → AI → vault + pgvector reference library

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "InspectionReason" AS ENUM (
  'INITIAL_INSPECTION',
  'REINSPECTION',
  'ENGINEER_EXPERT_INSPECTION',
  'SUPPLEMENTAL_INSPECTION',
  'APPRAISAL_INSPECTION',
  'MITIGATION_WALKTHROUGH',
  'CUSTOM'
);

CREATE TYPE "PhotoSyncStatus" AS ENUM ('PENDING', 'ANALYZED', 'SYNCED');

ALTER TABLE "InspectionItem"
  ADD COLUMN "aiSuggestedCategory" "InspectionCategory",
  ADD COLUMN "aiSuggestedIndicator" TEXT,
  ADD COLUMN "aiConfidence" "Confidence",
  ADD COLUMN "aiEstimatedSeverity" "Severity",
  ADD COLUMN "aiRationale" TEXT,
  ADD COLUMN "similarReferenceIds" JSONB,
  ADD COLUMN "adjusterConfirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "adjusterFinalCategory" "InspectionCategory";

CREATE INDEX "InspectionItem_adjusterConfirmed_idx" ON "InspectionItem"("adjusterConfirmed");

CREATE TABLE "InspectionSession" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" "InspectionReason" NOT NULL DEFAULT 'INITIAL_INSPECTION',
    "customReasonText" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InspectionSession_claimId_idx" ON "InspectionSession"("claimId");
CREATE INDEX "InspectionSession_inspectionId_idx" ON "InspectionSession"("inspectionId");
CREATE INDEX "InspectionSession_createdById_idx" ON "InspectionSession"("createdById");

ALTER TABLE "InspectionSession" ADD CONSTRAINT "InspectionSession_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionSession" ADD CONSTRAINT "InspectionSession_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionSession" ADD CONSTRAINT "InspectionSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Photo: make item optional, add session/vault/AI columns
ALTER TABLE "Photo" DROP CONSTRAINT "Photo_inspectionItemId_fkey";
ALTER TABLE "Photo" ALTER COLUMN "inspectionItemId" DROP NOT NULL;

ALTER TABLE "Photo"
  ADD COLUMN "inspectionId" TEXT,
  ADD COLUMN "inspectionSessionId" TEXT,
  ADD COLUMN "storagePath" TEXT,
  ADD COLUMN "locationTag" TEXT,
  ADD COLUMN "captureDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN "reason" "InspectionReason" NOT NULL DEFAULT 'INITIAL_INSPECTION',
  ADD COLUMN "customReasonText" TEXT,
  ADD COLUMN "aiDescription" TEXT,
  ADD COLUMN "adjusterEditedDescription" TEXT,
  ADD COLUMN "gpsLat" DECIMAL(10,7),
  ADD COLUMN "gpsLng" DECIMAL(11,7),
  ADD COLUMN "syncStatus" "PhotoSyncStatus" NOT NULL DEFAULT 'PENDING';

-- Backfill inspectionId from parent item if any leftover rows exist
UPDATE "Photo" AS p
SET "inspectionId" = i."inspectionId"
FROM "InspectionItem" AS i
WHERE p."inspectionItemId" = i."id" AND p."inspectionId" IS NULL;

DELETE FROM "Photo" WHERE "inspectionId" IS NULL;
ALTER TABLE "Photo" ALTER COLUMN "inspectionId" SET NOT NULL;

CREATE INDEX "Photo_inspectionId_idx" ON "Photo"("inspectionId");
CREATE INDEX "Photo_inspectionSessionId_idx" ON "Photo"("inspectionSessionId");
CREATE INDEX "Photo_syncStatus_idx" ON "Photo"("syncStatus");

ALTER TABLE "Photo" ADD CONSTRAINT "Photo_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_inspectionSessionId_fkey" FOREIGN KEY ("inspectionSessionId") REFERENCES "InspectionSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_inspectionItemId_fkey" FOREIGN KEY ("inspectionItemId") REFERENCES "InspectionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DocumentVaultEntry" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "photoId" TEXT,
    "documentId" TEXT,
    "displayPath" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVaultEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentVaultEntry_photoId_key" ON "DocumentVaultEntry"("photoId");
CREATE UNIQUE INDEX "DocumentVaultEntry_documentId_key" ON "DocumentVaultEntry"("documentId");
CREATE INDEX "DocumentVaultEntry_claimId_idx" ON "DocumentVaultEntry"("claimId");
CREATE INDEX "DocumentVaultEntry_uploadedById_idx" ON "DocumentVaultEntry"("uploadedById");

ALTER TABLE "DocumentVaultEntry" ADD CONSTRAINT "DocumentVaultEntry_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentVaultEntry" ADD CONSTRAINT "DocumentVaultEntry_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentVaultEntry" ADD CONSTRAINT "DocumentVaultEntry_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentVaultEntry" ADD CONSTRAINT "DocumentVaultEntry_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ReferenceExample" (
    "id" TEXT NOT NULL,
    "category" "InspectionCategory" NOT NULL,
    "indicatorType" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "sourceNote" TEXT NOT NULL,
    "embedding" vector(384),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceExample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReferenceExample_category_indicatorType_idx" ON "ReferenceExample"("category", "indicatorType");
CREATE INDEX "ReferenceExample_indicatorType_idx" ON "ReferenceExample"("indicatorType");
CREATE INDEX "ReferenceExample_embedding_idx" ON "ReferenceExample" USING hnsw ("embedding" vector_cosine_ops);

CREATE OR REPLACE FUNCTION match_reference_examples(query vector(384), match_count integer)
RETURNS TABLE (
  id text,
  category "InspectionCategory",
  "indicatorType" text,
  "imageUrl" text,
  description text,
  "sourceNote" text,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    r.id,
    r.category,
    r."indicatorType",
    r."imageUrl",
    r.description,
    r."sourceNote",
    (1 - (r.embedding <=> query))::double precision AS similarity
  FROM "ReferenceExample" r
  WHERE r.embedding IS NOT NULL
  ORDER BY r.embedding <=> query
  LIMIT match_count;
$$;

ALTER TABLE "InspectionSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentVaultEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReferenceExample" ENABLE ROW LEVEL SECURITY;
