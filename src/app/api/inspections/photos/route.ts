import { NextResponse } from "next/server";
import { canEdit, getSession, resolveSessionAdjuster } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storeInspectionPhoto } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const id = String(form.get("id") ?? "");
  const inspectionId = String(form.get("inspectionId") ?? "");
  const inspectionItemId = String(form.get("inspectionItemId") ?? "");
  const file = form.get("file");

  if (!id || !inspectionId || !(file instanceof File)) {
    return NextResponse.json({ error: "INVALID_UPLOAD" }, { status: 400 });
  }

  const item = await prisma.inspectionItem.findUnique({
    where: { id: inspectionItemId },
    select: {
      inspectionId: true,
      inspection: { select: { adjusterId: true } },
    },
  });

  if (item && item.inspectionId !== inspectionId) {
    return NextResponse.json({ error: "ITEM_MISMATCH" }, { status: 400 });
  }
  if (
    item &&
    adjuster.role === "ADJUSTER" &&
    item.inspection.adjusterId !== adjuster.id
  ) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const stored = await storeInspectionPhoto({
    inspectionId,
    photoId: id,
    bytes,
    mimeType: file.type || "image/jpeg",
  });

  if (item) {
    await prisma.photo.upsert({
      where: { id },
      create: {
        id,
        inspectionId,
        inspectionItemId: inspectionItemId || null,
        url: stored.fileUrl,
        captureDate: new Date(),
        capturedAt: new Date(),
      },
      update: { url: stored.fileUrl },
    });
  }

  return NextResponse.json({ url: stored.fileUrl, storagePath: stored.storagePath });
}
