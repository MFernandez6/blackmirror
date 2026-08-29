-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "coverageALimit" DECIMAL(14,2),
ADD COLUMN     "coverageAnalysis" TEXT,
ADD COLUMN     "coverageBLimit" DECIMAL(14,2),
ADD COLUMN     "coverageCLimit" DECIMAL(14,2),
ADD COLUMN     "coverageDLimit" DECIMAL(14,2),
ADD COLUMN     "policyEndorsements" TEXT,
ADD COLUMN     "policyExclusions" TEXT,
ADD COLUMN     "policyParsedAt" TIMESTAMP(3);
