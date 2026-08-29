import { NextResponse } from "next/server";
import { getSession, resolveSessionAdjuster } from "@/lib/auth";
import { listAssignedClaimsForAdjuster } from "@/lib/inspection/assigned";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const adjuster = session ? await resolveSessionAdjuster(session) : null;
  if (!adjuster) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const claims = await listAssignedClaimsForAdjuster(adjuster);
  return NextResponse.json({ claims });
}
