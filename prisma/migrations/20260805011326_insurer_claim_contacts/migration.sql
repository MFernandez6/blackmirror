-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "deskExaminerEmail" TEXT,
ADD COLUMN     "deskExaminerName" TEXT,
ADD COLUMN     "deskExaminerPhone" TEXT,
ADD COLUMN     "experts" JSONB,
ADD COLUMN     "fieldAdjusterEmail" TEXT,
ADD COLUMN     "fieldAdjusterName" TEXT,
ADD COLUMN     "fieldAdjusterPhone" TEXT,
ADD COLUMN     "insurerClaimNumber" TEXT;

-- CreateIndex
CREATE INDEX "Claim_insurerClaimNumber_idx" ON "Claim"("insurerClaimNumber");
