import {
  cacheClaim,
  findOpenInspectionForClaim,
  getLocalInspection,
  startLocalInspection,
} from "@/lib/offline/repo";
import { runSync } from "@/lib/offline/sync";
import type { CachedClaim } from "@/lib/offline/types";
import type { LossType } from "@/lib/inspection/indicators";

export async function openClaimInspection(opts: {
  claim: CachedClaim;
  adjusterId: string;
  adjusterName: string;
  peril?: LossType;
}): Promise<string> {
  await cacheClaim(opts.claim);

  const localOpen = await findOpenInspectionForClaim(
    opts.claim.id,
    opts.adjusterId
  );
  if (localOpen) return localOpen.id;

  if (
    navigator.onLine &&
    opts.claim.latestInspectionId &&
    opts.claim.latestInspectionStatus === "IN_PROGRESS"
  ) {
    await runSync();
    const pulled = await getLocalInspection(opts.claim.latestInspectionId);
    if (pulled) return pulled.id;
    const afterSync = await findOpenInspectionForClaim(
      opts.claim.id,
      opts.adjusterId
    );
    if (afterSync) return afterSync.id;
  }

  const inspection = await startLocalInspection({
    claim: opts.claim,
    adjusterId: opts.adjusterId,
    adjusterName: opts.adjusterName,
    peril: opts.peril ?? opts.claim.lossType,
  });
  if (navigator.onLine) {
    await runSync();
  } else {
    void runSync();
  }
  return inspection.id;
}
