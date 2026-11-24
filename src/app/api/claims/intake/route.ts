import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const gone = {
  error: "CLAIM_CREATE_DISABLED",
  message:
    "Field inspections attach to a claim BLACKBOX already opened. Look up the claim number.",
};

/** Claim numbers are allocated in BLACKBOX. This route no longer writes a Claim. */
export function GET() {
  return NextResponse.json(gone, { status: 410 });
}

export function POST() {
  return NextResponse.json(gone, { status: 410 });
}
