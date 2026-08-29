-- BLACKMIRROR field inspection module (additive — safe on existing BLACKBOX DB)

-- AlterEnum
ALTER TYPE "DocType" ADD VALUE 'INSPECTION_REPORT';

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InspectionCategory" AS ENUM ('WATER', 'STRUCTURAL', 'ROOF', 'INTERIOR', 'MECHANICAL', 'EXTERIOR');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('MINOR', 'MODERATE', 'SEVERE', 'CRITICAL');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('CONFIRMED', 'SUSPECTED');

-- CreateEnum
CREATE TYPE "Presence" AS ENUM ('UNSET', 'PRESENT', 'NOT_PRESENT');

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Primary',
    "address" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "gpsLat" DECIMAL(10,7),
    "gpsLng" DECIMAL(11,7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "adjusterId" TEXT NOT NULL,
    "perilTemplate" "LossType" NOT NULL,
    "status" "InspectionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "narrativeDraft" TEXT,
    "narrativeFinal" TEXT,
    "clientRev" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionItem" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "category" "InspectionCategory" NOT NULL,
    "indicatorType" TEXT NOT NULL,
    "presence" "Presence" NOT NULL DEFAULT 'UNSET',
    "severity" "Severity",
    "confidence" "Confidence",
    "notes" TEXT,
    "measurementValue" DECIMAL(12,3),
    "measurementUnit" TEXT,
    "gpsLat" DECIMAL(10,7),
    "gpsLng" DECIMAL(11,7),
    "capturedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "clientRev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "inspectionItemId" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "exifData" JSONB,
    "annotations" JSONB,
    "caption" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientRev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Property_claimId_idx" ON "Property"("claimId");

-- CreateIndex
CREATE INDEX "Inspection_claimId_idx" ON "Inspection"("claimId");

-- CreateIndex
CREATE INDEX "Inspection_propertyId_idx" ON "Inspection"("propertyId");

-- CreateIndex
CREATE INDEX "Inspection_adjusterId_idx" ON "Inspection"("adjusterId");

-- CreateIndex
CREATE INDEX "Inspection_status_idx" ON "Inspection"("status");

-- CreateIndex
CREATE INDEX "Inspection_updatedAt_idx" ON "Inspection"("updatedAt");

-- CreateIndex
CREATE INDEX "InspectionItem_inspectionId_category_idx" ON "InspectionItem"("inspectionId", "category");

-- CreateIndex
CREATE INDEX "InspectionItem_indicatorType_idx" ON "InspectionItem"("indicatorType");

-- CreateIndex
CREATE INDEX "InspectionItem_updatedAt_idx" ON "InspectionItem"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionItem_inspectionId_indicatorType_key" ON "InspectionItem"("inspectionId", "indicatorType");

-- CreateIndex
CREATE INDEX "Photo_inspectionItemId_idx" ON "Photo"("inspectionItemId");

-- CreateIndex
CREATE INDEX "Photo_capturedAt_idx" ON "Photo"("capturedAt");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_adjusterId_fkey" FOREIGN KEY ("adjusterId") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_inspectionItemId_fkey" FOREIGN KEY ("inspectionItemId") REFERENCES "InspectionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: Prisma uses the postgres role (bypasses RLS). Deny Data API (anon /
-- authenticated) by enabling RLS with no policies for those roles.
ALTER TABLE "Property" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Inspection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InspectionItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Photo" ENABLE ROW LEVEL SECURITY;
