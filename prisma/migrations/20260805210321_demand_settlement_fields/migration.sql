-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "acvAmount" DECIMAL(14,2),
ADD COLUMN     "demandAmount" DECIMAL(14,2),
ADD COLUMN     "demandSentDate" DATE,
ADD COLUMN     "rcvAmount" DECIMAL(14,2),
ADD COLUMN     "settlementAmount" DECIMAL(14,2),
ADD COLUMN     "settlementDate" DATE,
ADD COLUMN     "settlementNotes" TEXT;
