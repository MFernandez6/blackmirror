import { NextResponse } from "next/server";
import { canEdit, getSession, resolveSessionAdjuster } from "@/lib/auth";
import { aiPhotoAnalysisAvailable, analyzeInspectionPhoto } from "@/lib/ai/analyze-photo";
import { findSimilarReferences } from "@/lib/ai/similar";
import { detectAllowedFile } from "@/lib/security/file-signature";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** 503 tells the field app to classify manually instead of retrying. */
function aiUnavailable() {
  return NextResponse.json(
    {
      error: "AI_UNAVAILABLE",
      message: "AI drafting is unavailable. Classify this photo yourself; it will still be filed.",
    },
    { status: 503 }
  );
}

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
  const detected = detectAllowedFile(bytes, file.name || "photo.jpg");
  if (!detected?.mime.startsWith("image/")) {
    return NextResponse.json({ error: "UNSUPPORTED_IMAGE" }, { status: 415 });
  }
  if (!aiPhotoAnalysisAvailable()) return aiUnavailable();

  try {
    const peril = String(form.get("peril") ?? "").trim() || null;
    const analysis = await analyzeInspectionPhoto({
      bytes,
      mimeType: detected.mime,
      peril,
    });
    const query = [
      analysis.category,
      analysis.indicatorType,
      analysis.estimatedSeverity,
      analysis.visualRationale,
    ].join(" ");
    const references = await findSimilarReferences(query, 3).catch((err) => {
      console.error("[analyze-photo] reference lookup failed", err);
      return [];
    });
    return NextResponse.json({
      draft: true,
      analysis,
      references,
      notice:
        "AI suggestion only. A licensed adjuster must review and confirm before this finding is used in the claim file.",
    });
  } catch (err) {
    console.error("[analyze-photo] AI analysis failed", err);
    return aiUnavailable();
  }
}
