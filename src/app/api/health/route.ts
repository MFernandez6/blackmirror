import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness only. Does not touch the database or report claim data. */
export async function GET() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
