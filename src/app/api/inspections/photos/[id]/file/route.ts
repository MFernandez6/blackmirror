import { NextResponse } from "next/server";
import { getSession, resolveSessionAdjuster } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signedObjectUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const adjuster = session ? await resolveSessionAdjuster(session) : null;
  if (!adjuster) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const photo = await prisma.photo.findUnique({
    where: { id: params.id },
    select: {
      url: true,
      inspection: {
        select: { adjusterId: true, claim: { select: { assignedAdjusterId: true } } },
      },
    },
  });
  if (!photo?.url) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (
    adjuster.role === "ADJUSTER" &&
    photo.inspection.adjusterId !== adjuster.id &&
    photo.inspection.claim.assignedAdjusterId !== adjuster.id
  ) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const signed = await signedObjectUrl(photo.url);
  if (!signed) {
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 404 });
  }
  const res = NextResponse.redirect(new URL(signed, _req.url), 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
