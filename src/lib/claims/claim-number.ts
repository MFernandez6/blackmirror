import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Atomically allocate the next BL-YY-#### claim number for the given year.
 * Must be called inside the same transaction that creates the Claim.
 */
export async function allocateClaimNumber(
  tx: Tx,
  year: number = new Date().getFullYear()
): Promise<string> {
  const row = await tx.claimNumberSequence.upsert({
    where: { year },
    create: { year, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  const yy = String(year).slice(-2);
  return `BL-${yy}-${String(row.lastValue).padStart(4, "0")}`;
}

export function formatClaimNumber(year: number, sequence: number): string {
  const yy = String(year).slice(-2);
  return `BL-${yy}-${String(sequence).padStart(4, "0")}`;
}
