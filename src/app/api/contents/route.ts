import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canEdit, getSession, resolveSessionAdjuster } from "@/lib/auth";
import { detectAllowedFile } from "@/lib/security/file-signature";
import { storeVaultPhoto } from "@/lib/storage";
import { contentsAiAvailable, identifyContentsItem, type ContentsHints } from "@/lib/ai/identify-contents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const IMAGE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function editor() {
  const session = await getSession();
  const adjuster = session ? await resolveSessionAdjuster(session) : null;
  if (!adjuster) return { error: "Unauthorized", status: 401 as const };
  if (!canEdit(adjuster.role)) return { error: "Insufficient privileges.", status: 403 as const };
  return { adjuster };
}

export async function POST(req: Request) {
  const gate = await editor();
  if ("error" in gate && gate.error) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (!("adjuster" in gate) || !gate.adjuster) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!contentsAiAvailable()) {
    return NextResponse.json({ error: "Contents pricing is not configured." }, { status: 503 });
  }

  const form = await req.formData();
  const claimId = String(form.get("claimId") ?? "").trim();
  const hints = readHints(form);
  if (!claimId || !hints) {
    return NextResponse.json({ error: "Enter the room and what the item is, then photograph it." }, { status: 422 });
  }
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: { id: true, claimNumber: true, isArchived: true, assignedAdjusterId: true },
  });
  if (!claim || claim.isArchived) {
    return NextResponse.json({ error: "That file is not open for contents." }, { status: 404 });
  }
  if (gate.adjuster.role === "ADJUSTER" && claim.assignedAdjusterId !== gate.adjuster.id) {
    return NextResponse.json({ error: "Not assigned to this file." }, { status: 403 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo." }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Photo must be 8 MB or smaller." }, { status: 413 });
  }
  const detected = detectAllowedFile(bytes, file.name || "contents.jpg");
  if (!detected || !IMAGE.has(detected.mime)) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WEBP photo." }, { status: 415 });
  }

  let identified;
  try {
    identified = await identifyContentsItem({ bytes, mimeType: detected.mime, hints });
  } catch (err) {
    console.error("[contents] identify failed", err);
    const message = err instanceof Error ? err.message : "";
    if (message === "Contents pricing rejected the API key." || message === "Contents pricing has no remaining API credits.") {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: "The product search did not finish. Keep the photo and try again." }, { status: 502 });
  }

  const stored = await storeVaultPhoto({
    storagePath: `claims/${claim.claimNumber}/contents/${Date.now()}-${hints.itemType.slice(0, 24).replace(/[^a-zA-Z0-9_-]/g, "_")}.${detected.ext}`,
    bytes,
    mimeType: detected.mime,
  });
  const document = await prisma.document.create({
    data: {
      claimId: claim.id,
      fileName: stored.storagePath.split("/").pop() || "contents.jpg",
      fileUrl: stored.fileUrl,
      fileSizeBytes: bytes.byteLength,
      mimeType: detected.mime,
      docType: "PHOTO",
      uploadedById: gate.adjuster.id,
    },
  });
  const item = await prisma.contentsItem.create({
    data: {
      claimId: claim.id,
      room: hints.room,
      quantity: identified.quantity,
      itemName: identified.itemName || hints.itemType,
      brand: identified.brand || hints.brand,
      modelNumber: identified.modelNumber || hints.modelNumber,
      description: withAge(identified.description, hints.age),
      notes: hints.age ? `Age: ${hints.age}` : null,
      condition: identified.condition,
      matchKind: identified.matchKind,
      productTitle: identified.productTitle,
      productUrl: identified.productUrl,
      listedPrice: identified.listedPrice,
      priceNote: identified.priceNote,
      documentId: document.id,
      sourceApp: "BLACKMIRROR",
      createdById: gate.adjuster.id,
    },
  });

  return NextResponse.json({
    item: {
      id: item.id,
      room: item.room,
      quantity: item.quantity,
      itemName: item.itemName,
      brand: item.brand,
      modelNumber: item.modelNumber,
      description: item.description,
      condition: item.condition,
      matchKind: item.matchKind,
      productTitle: item.productTitle,
      productUrl: item.productUrl,
      listedPrice: item.listedPrice?.toString() ?? null,
      priceNote: item.priceNote,
    },
  });
}

export async function PATCH(req: Request) {
  const gate = await editor();
  if ("error" in gate && gate.error) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (!("adjuster" in gate) || !gate.adjuster) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    id?: string;
    quantity?: number;
    unitCost?: number | null;
  } | null;
  if (!body?.id) return NextResponse.json({ error: "Missing item." }, { status: 400 });
  const existing = await prisma.contentsItem.findUnique({
    where: { id: body.id },
    select: { id: true, listedPrice: true, claim: { select: { assignedAdjusterId: true, isArchived: true } } },
  });
  if (!existing || existing.claim.isArchived) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }
  if (gate.adjuster.role === "ADJUSTER" && existing.claim.assignedAdjusterId !== gate.adjuster.id) {
    return NextResponse.json({ error: "Not assigned to this file." }, { status: 403 });
  }
  const quantity = Number(body.quantity);
  const unit = body.unitCost === null || body.unitCost === undefined ? null : Number(body.unitCost);
  const cost = unit ?? (existing.listedPrice ? Number(existing.listedPrice) : null);
  if (cost === null || !Number.isFinite(cost) || cost < 0) {
    return NextResponse.json({ error: "Enter a unit cost before adding the line." }, { status: 422 });
  }
  await prisma.contentsItem.update({
    where: { id: existing.id },
    data: {
      quantity: Number.isFinite(quantity) ? Math.min(999, Math.max(1, Math.round(quantity))) : 1,
      confirmedUnitCost: Math.round(cost * 100) / 100,
      confirmed: true,
    },
  });
  return NextResponse.json({ ok: true });
}

function clipField(form: FormData, key: string, max: number) {
  const text = String(form.get(key) ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
  return text || null;
}

function readHints(form: FormData): ContentsHints | null {
  const room = clipField(form, "room", 80);
  const itemType = clipField(form, "itemType", 80);
  if (!room || room.length < 2 || !itemType || itemType.length < 2) return null;
  return {
    room,
    itemType,
    brand: clipField(form, "brand", 80),
    modelNumber: clipField(form, "model", 80),
    age: clipField(form, "age", 40),
  };
}

function withAge(description: string, age: string | null) {
  if (!age) return description || null;
  const note = `Approximate age: ${age}.`;
  return description ? `${description} ${note}`.slice(0, 600) : note;
}
