-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('INTAKE', 'UNDER_REVIEW', 'INVESTIGATION', 'FILED', 'NEGOTIATING', 'SETTLED', 'CLOSED', 'DENIED');

-- CreateEnum
CREATE TYPE "LossType" AS ENUM ('WIND', 'FIRE', 'WATER', 'HAIL', 'VANDALISM', 'OTHER');

-- CreateEnum
CREATE TYPE "PreferredContactMethod" AS ENUM ('EMAIL', 'PHONE', 'TEXT');

-- CreateEnum
CREATE TYPE "AdjusterRole" AS ENUM ('ADMIN', 'ADJUSTER', 'VIEWER');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('POLICY', 'ESTIMATE', 'PHOTO', 'CORRESPONDENCE', 'ENGINEERING_REPORT', 'DEMAND_LETTER', 'OTHER');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'COMPLETE', 'FAILED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ADVANCE', 'SETTLEMENT', 'FEE');

-- CreateTable
CREATE TABLE "ClaimNumberSequence" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClaimNumberSequence_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "Adjuster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "role" "AdjusterRole" NOT NULL DEFAULT 'ADJUSTER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Adjuster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'INTAKE',
    "lossType" "LossType" NOT NULL,
    "dateOfLoss" DATE NOT NULL,
    "propertyAddress" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "lossDescription" TEXT,
    "policyNumber" TEXT,
    "carrierName" TEXT,
    "estimatedValue" DECIMAL(14,2),
    "isCatClaim" BOOLEAN NOT NULL DEFAULT false,
    "contingencyFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    "assignedAdjusterId" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claimant" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "mailingAddress" TEXT NOT NULL,
    "preferredContactMethod" "PreferredContactMethod" NOT NULL DEFAULT 'EMAIL',
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claimant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "docType" "DocType" NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extractedData" JSONB,
    "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "previousStatus" "ClaimStatus",
    "newStatus" "ClaimStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Adjuster_email_key" ON "Adjuster"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_claimNumber_key" ON "Claim"("claimNumber");

-- CreateIndex
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- CreateIndex
CREATE INDEX "Claim_assignedAdjusterId_idx" ON "Claim"("assignedAdjusterId");

-- CreateIndex
CREATE INDEX "Claim_status_lossType_idx" ON "Claim"("status", "lossType");

-- CreateIndex
CREATE INDEX "Claim_isArchived_idx" ON "Claim"("isArchived");

-- CreateIndex
CREATE INDEX "Claim_updatedAt_idx" ON "Claim"("updatedAt");

-- CreateIndex
CREATE INDEX "Claimant_claimId_idx" ON "Claimant"("claimId");

-- CreateIndex
CREATE INDEX "Claimant_lastName_firstName_idx" ON "Claimant"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Document_claimId_idx" ON "Document"("claimId");

-- CreateIndex
CREATE INDEX "Document_docType_idx" ON "Document"("docType");

-- CreateIndex
CREATE INDEX "Document_uploadedById_idx" ON "Document"("uploadedById");

-- CreateIndex
CREATE INDEX "StatusHistory_claimId_changedAt_idx" ON "StatusHistory"("claimId", "changedAt");

-- CreateIndex
CREATE INDEX "StatusHistory_changedById_idx" ON "StatusHistory"("changedById");

-- CreateIndex
CREATE INDEX "Payment_claimId_idx" ON "Payment"("claimId");

-- CreateIndex
CREATE INDEX "Payment_recordedById_idx" ON "Payment"("recordedById");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_assignedAdjusterId_fkey" FOREIGN KEY ("assignedAdjusterId") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claimant" ADD CONSTRAINT "Claimant_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
