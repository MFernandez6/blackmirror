import { NextResponse } from "next/server";
import { getSession, resolveSessionAdjuster } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lookupClaimSchema } from "@/lib/schemas/inspection";
import { normalizeClaimNumber } from "@/lib/utils";
import { toCachedClaim } from "@/lib/inspection/serialize";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  const adjuster = session ? await resolveSessionAdjuster(session) : null;
  if (!adjuster) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = lookupClaimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_CLAIM_NUMBER" }, { status: 400 });
  }

  const claimNumber = normalizeClaimNumber(parsed.data.claimNumber);
  const claim = await prisma.claim.findFirst({
    where: {
      claimNumber,
      isArchived: false,
    },
    select: { id: true },
  });

  if (!claim) {
    return NextResponse.json({ error: "CLAIM_NOT_FOUND" }, { status: 404 });
  }

  const cached = await toCachedClaim(claim.id);
  return NextResponse.json(cached);
}
