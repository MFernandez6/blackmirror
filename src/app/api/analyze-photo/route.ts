import { NextResponse } from "next/server";
import { canEdit, getSession, resolveSessionAdjuster } from "@/lib/auth";
import { analyzeInspectionPhoto } from "@/lib/ai/analyze-photo";
import { findSimilarReferences } from "@/lib/ai/similar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();
  const adjuster = session ? await resolveSessionAdjuster(session) : null;
  if (!adjuster) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!canEdit(adjuster.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "NO_IMAGE" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "IMAGE_TOO_LARGE" }, { status: 413 });
  }

  try {
    const analysis = await analyzeInspectionPhoto({
      bytes,
      mimeType: file.type || "image/jpeg",
    });
    const query = [
      analysis.category,
      analysis.indicatorType,
      analysis.estimatedSeverity,
      analysis.visualRationale,
    ].join(" ");
    const references = await findSimilarReferences(query, 3);
    return NextResponse.json({
      draft: true,
      analysis,
      references,
      notice:
        "AI suggestion only. A licensed adjuster must review and confirm before this finding is used in the claim file.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ANALYSIS_FAILED";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
