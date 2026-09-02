import { NextResponse } from "next/server";
import { canEdit, getSession, resolveSessionAdjuster } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeStoredPhoto } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  const adjuster = session ? await resolveSessionAdjuster(session) : null;
  if (!adjuster) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!canEdit(adjuster.role)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "INVALID_PHOTO" }, { status: 400 });
  }

  const photo = await prisma.photo.findUnique({
    where: { id },
    include: {
      vaultEntry: true,
      inspection: { select: { adjusterId: true } },
    },
  });
  if (!photo) {
    return NextResponse.json({ ok: true, missing: true });
  }
  if (
    adjuster.role === "ADJUSTER" &&
    photo.inspection.adjusterId !== adjuster.id
  ) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const documentId = photo.vaultEntry?.documentId ?? null;
  const vaultId = photo.vaultEntry?.id ?? null;

  await prisma.$transaction(async (tx) => {
    if (vaultId) {
      await tx.documentVaultEntry.delete({ where: { id: vaultId } });
    }
    if (documentId) {
      await tx.document.delete({ where: { id: documentId } });
    }
    await tx.photo.delete({ where: { id } });
  });

  await removeStoredPhoto({
    photoId: id,
    inspectionId: photo.inspectionId,
    storagePath: photo.storagePath,
    fileUrl: photo.url,
  });

  return NextResponse.json({ ok: true });
}
