-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "isCertifiedPolicy" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ClaimAuditEvent" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClaimAuditEvent_claimId_createdAt_idx" ON "ClaimAuditEvent"("claimId", "createdAt");

-- CreateIndex
CREATE INDEX "ClaimAuditEvent_actorId_idx" ON "ClaimAuditEvent"("actorId");

-- CreateIndex
CREATE INDEX "ClaimAuditEvent_action_idx" ON "ClaimAuditEvent"("action");

-- CreateIndex
CREATE INDEX "Document_isCertifiedPolicy_idx" ON "Document"("isCertifiedPolicy");

-- AddForeignKey
ALTER TABLE "ClaimAuditEvent" ADD CONSTRAINT "ClaimAuditEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimAuditEvent" ADD CONSTRAINT "ClaimAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
