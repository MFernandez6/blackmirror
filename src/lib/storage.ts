import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const INSPECTION_PHOTOS_BUCKET = "inspection-photos";
export const CLAIM_DOCS_BUCKET = "claim-documents";

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function publicObjectUrl(cfg: { url: string }, bucket: string, objectPath: string) {
  return `${cfg.url}/storage/v1/object/public/${bucket}/${objectPath}`;
}

async function uploadObject(opts: {
  bucket: string;
  objectPath: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<{ fileUrl: string; storagePath: string }> {
  const cfg = supabaseConfig();
  if (cfg) {
    const endpoint = `${cfg.url}/storage/v1/object/${opts.bucket}/${opts.objectPath}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        apikey: cfg.key,
        "Content-Type": opts.mimeType || "image/jpeg",
        "x-upsert": "true",
      },
      body: new Uint8Array(opts.bytes),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Storage upload failed (${res.status}): ${detail || res.statusText}`
      );
    }
    return {
      fileUrl: publicObjectUrl(cfg, opts.bucket, opts.objectPath),
      storagePath: opts.objectPath,
    };
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Photo storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const abs = path.join(process.cwd(), "public", "uploads", opts.objectPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, opts.bytes);
  return {
    fileUrl: `/uploads/${opts.objectPath}`.replace(/\\/g, "/"),
    storagePath: opts.objectPath,
  };
}

export async function storeInspectionPhoto(opts: {
  inspectionId: string;
  photoId: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<{ fileUrl: string; storagePath: string }> {
  const objectPath = `${opts.inspectionId}/${opts.photoId}.jpg`;
  try {
    return await uploadObject({
      bucket: INSPECTION_PHOTOS_BUCKET,
      objectPath,
      bytes: opts.bytes,
      mimeType: opts.mimeType,
    });
  } catch {
    return uploadObject({
      bucket: CLAIM_DOCS_BUCKET,
      objectPath,
      bytes: opts.bytes,
      mimeType: opts.mimeType,
    });
  }
}

/** BLACKBOX vault path: claims/{claimNumber}/{date}_{reason}/{location}/{time}_{desc}.jpg */
export async function storeVaultPhoto(opts: {
  storagePath: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<{ fileUrl: string; storagePath: string }> {
  return uploadObject({
    bucket: CLAIM_DOCS_BUCKET,
    objectPath: opts.storagePath,
    bytes: opts.bytes,
    mimeType: opts.mimeType,
  });
}

function parsePublicObjectUrl(
  fileUrl: string
): { bucket: string; objectPath: string } | null {
  const match = fileUrl.match(
    /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/
  );
  if (!match) return null;
  return { bucket: match[1], objectPath: decodeURIComponent(match[2]) };
}

async function deleteObject(opts: {
  bucket: string;
  objectPath: string;
}): Promise<void> {
  const cfg = supabaseConfig();
  if (!cfg) return;
  const endpoint = `${cfg.url}/storage/v1/object/${opts.bucket}/${opts.objectPath}`;
  const res = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      apikey: cfg.key,
    },
  });
  if (!res.ok && res.status !== 404) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Storage delete failed (${res.status}): ${detail || res.statusText}`
    );
  }
}

/** Best-effort removal of a vault or inspection photo object. */
export async function removeStoredPhoto(opts: {
  photoId: string;
  inspectionId?: string | null;
  storagePath?: string | null;
  fileUrl?: string | null;
}): Promise<void> {
  const seen = new Set<string>();
  const targets: { bucket: string; objectPath: string }[] = [];

  function add(bucket: string, objectPath: string) {
    const key = `${bucket}:${objectPath}`;
    if (!objectPath || seen.has(key)) return;
    seen.add(key);
    targets.push({ bucket, objectPath });
  }

  if (opts.storagePath) {
    add(CLAIM_DOCS_BUCKET, opts.storagePath);
    add(INSPECTION_PHOTOS_BUCKET, opts.storagePath);
  }
  if (opts.inspectionId) {
    add(INSPECTION_PHOTOS_BUCKET, `${opts.inspectionId}/${opts.photoId}.jpg`);
    add(CLAIM_DOCS_BUCKET, `${opts.inspectionId}/${opts.photoId}.jpg`);
  }
  if (opts.fileUrl) {
    const parsed = parsePublicObjectUrl(opts.fileUrl);
    if (parsed) add(parsed.bucket, parsed.objectPath);
  }

  for (const target of targets) {
    try {
      await deleteObject(target);
    } catch {
      // Orphaned objects are preferable to a failed delete of the file record.
    }
  }
}
