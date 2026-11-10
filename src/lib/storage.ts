import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const CLAIM_DOCS_BUCKET = "claim-documents";
/** Signed links handed to the browser expire quickly; the app re-signs on every view. */
export const SIGNED_URL_TTL_SECONDS = 300;

const BUCKETS = [CLAIM_DOCS_BUCKET];

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) return { url, key: serviceKey };
  if (process.env.VERCEL) {
    if (url) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required in production; claim files live in a private bucket."
      );
    }
    return null;
  }
  const devKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !devKey) return null;
  return { url, key: devKey };
}

/**
 * Canonical object reference persisted in Photo.url / Document.fileUrl.
 * Buckets are private, so this URL is an identifier only — it never grants access.
 */
function canonicalObjectUrl(cfg: { url: string }, bucket: string, objectPath: string) {
  return `${cfg.url}/storage/v1/object/public/${bucket}/${objectPath}`;
}

/** Browser-facing link for a stored inspection photo: access-checked app route. */
export function photoHref(photoId: string): string {
  return `/api/inspections/photos/${photoId}/file`;
}

export function parseStoredObjectUrl(
  fileUrl: string
): { bucket: string; objectPath: string } | null {
  const match = fileUrl.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
  if (!match || !BUCKETS.includes(match[1])) return null;
  return { bucket: match[1], objectPath: decodeURIComponent(match[2]) };
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
      console.error(`[storage] upload failed (${res.status}) ${opts.bucket}: ${detail}`);
      throw new Error(`Storage upload failed (${res.status})`);
    }
    return {
      fileUrl: canonicalObjectUrl(cfg, opts.bucket, opts.objectPath),
      storagePath: opts.objectPath,
    };
  }

  const abs = path.join(process.cwd(), "public", "uploads", opts.objectPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, opts.bytes);
  return {
    fileUrl: `/uploads/${opts.objectPath}`.replace(/\\/g, "/"),
    storagePath: opts.objectPath,
  };
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

/** Short-lived signed URL for a stored photo (null when the URL is not a storage object). */
export async function signedObjectUrl(
  fileUrl: string,
  opts: { expiresInSeconds?: number } = {}
): Promise<string | null> {
  if (fileUrl.startsWith("/uploads/") && !process.env.VERCEL) return fileUrl;
  const target = parseStoredObjectUrl(fileUrl);
  const cfg = supabaseConfig();
  if (!target || !cfg) return null;
  const encoded = target.objectPath.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`${cfg.url}/storage/v1/object/sign/${target.bucket}/${encoded}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      apikey: cfg.key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: opts.expiresInSeconds ?? SIGNED_URL_TTL_SECONDS }),
  });
  if (!res.ok) {
    console.error(`[storage] sign failed (${res.status}) for ${target.bucket}/${target.objectPath}`);
    return null;
  }
  const data = (await res.json()) as { signedURL?: string; signedUrl?: string };
  const signed = data.signedURL || data.signedUrl;
  if (!signed) return null;
  return signed.startsWith("http")
    ? signed
    : `${cfg.url}/storage/v1${signed.startsWith("/") ? "" : "/"}${signed}`;
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
  }
  if (opts.inspectionId) {
    add(CLAIM_DOCS_BUCKET, `${opts.inspectionId}/${opts.photoId}.jpg`);
  }
  if (opts.fileUrl) {
    const parsed = parseStoredObjectUrl(opts.fileUrl);
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
