import type { ClaimStatus } from "@prisma/client";

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  INTAKE: "Intake",
  UNDER_REVIEW: "Under Review",
  INVESTIGATION: "Investigation",
  FILED: "Filed",
  NEGOTIATING: "Negotiating",
  SETTLED: "Settled",
  CLOSED: "Closed",
  DENIED: "Denied",
};

export const OPEN_CLAIM_STATUSES: ClaimStatus[] = [
  "INTAKE",
  "UNDER_REVIEW",
  "INVESTIGATION",
  "FILED",
  "NEGOTIATING",
];

export function isOpenClaimStatus(status: string | undefined): boolean {
  return OPEN_CLAIM_STATUSES.includes(status as ClaimStatus);
}

export function claimStatusLabel(status: string | undefined): string {
  if (!status) return "File";
  return CLAIM_STATUS_LABELS[status as ClaimStatus] ?? status.replaceAll("_", " ");
}
