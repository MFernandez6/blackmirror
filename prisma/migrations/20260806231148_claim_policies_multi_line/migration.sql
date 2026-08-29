-- CreateEnum
CREATE TYPE "PolicyLine" AS ENUM ('HOMEOWNERS', 'CONDO_MASTER', 'COMMERCIAL_PROPERTY', 'CGL', 'UMBRELLA', 'EXCESS', 'FLOOD', 'AUTO', 'WORKERS_COMP', 'OTHER');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "policyLine" "PolicyLine";

-- CreateTable
CREATE TABLE "ClaimPolicy" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "line" "PolicyLine" NOT NULL DEFAULT 'OTHER',
    "label" TEXT,
    "policyNumber" TEXT,
    "carrierName" TEXT,
    "namedInsured" TEXT,
    "effectiveDate" DATE,
    "expirationDate" DATE,
    "limits" JSONB,
    "deductibleNotes" TEXT,
    "exclusions" TEXT,
    "endorsements" TEXT,
    "analysis" TEXT,
    "premium" DECIMAL(14,2),
    "documentId" TEXT,
    "parsedAt" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClaimPolicy_claimId_idx" ON "ClaimPolicy"("claimId");

-- CreateIndex
CREATE INDEX "ClaimPolicy_line_idx" ON "ClaimPolicy"("line");

-- CreateIndex
CREATE INDEX "ClaimPolicy_documentId_idx" ON "ClaimPolicy"("documentId");

-- CreateIndex
CREATE INDEX "Document_policyLine_idx" ON "Document"("policyLine");

-- AddForeignKey
ALTER TABLE "ClaimPolicy" ADD CONSTRAINT "ClaimPolicy_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimPolicy" ADD CONSTRAINT "ClaimPolicy_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
