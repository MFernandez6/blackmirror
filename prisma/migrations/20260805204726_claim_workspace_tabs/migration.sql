-- CreateEnum
CREATE TYPE "ContactKind" AS ENUM ('VENDOR', 'CONTRACTOR', 'MITIGATION', 'ENGINEER', 'ATTORNEY', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "estimateCreatedDate" DATE,
ADD COLUMN     "estimateSentDate" DATE,
ADD COLUMN     "initialContactDate" DATE,
ADD COLUMN     "lossInspectedDate" DATE,
ADD COLUMN     "reportCreatedDate" DATE,
ADD COLUMN     "scheduledAppointmentDate" DATE;

-- CreateTable
CREATE TABLE "ClaimContact" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "kind" "ContactKind" NOT NULL DEFAULT 'VENDOR',
    "name" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimTask" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" DATE,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimNote" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimEmail" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "direction" "EmailDirection" NOT NULL DEFAULT 'OUTBOUND',
    "subject" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "ccAddress" TEXT,
    "body" TEXT NOT NULL,
    "emailDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClaimContact_claimId_idx" ON "ClaimContact"("claimId");

-- CreateIndex
CREATE INDEX "ClaimContact_kind_idx" ON "ClaimContact"("kind");

-- CreateIndex
CREATE INDEX "ClaimTask_claimId_status_idx" ON "ClaimTask"("claimId", "status");

-- CreateIndex
CREATE INDEX "ClaimTask_assignedToId_idx" ON "ClaimTask"("assignedToId");

-- CreateIndex
CREATE INDEX "ClaimTask_dueDate_idx" ON "ClaimTask"("dueDate");

-- CreateIndex
CREATE INDEX "ClaimNote_claimId_createdAt_idx" ON "ClaimNote"("claimId", "createdAt");

-- CreateIndex
CREATE INDEX "ClaimEmail_claimId_emailDate_idx" ON "ClaimEmail"("claimId", "emailDate");

-- AddForeignKey
ALTER TABLE "ClaimContact" ADD CONSTRAINT "ClaimContact_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimContact" ADD CONSTRAINT "ClaimContact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimTask" ADD CONSTRAINT "ClaimTask_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimTask" ADD CONSTRAINT "ClaimTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimTask" ADD CONSTRAINT "ClaimTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimNote" ADD CONSTRAINT "ClaimNote_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimNote" ADD CONSTRAINT "ClaimNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEmail" ADD CONSTRAINT "ClaimEmail_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEmail" ADD CONSTRAINT "ClaimEmail_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
