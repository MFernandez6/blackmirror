/**
 * Claim-file upload allowlist. Types are identified from the file's leading
 * bytes, not the browser-supplied MIME type, so a renamed executable or script
 * is rejected.
 */

export type DetectedFile = { mime: string; ext: string };

function startsWith(bytes: Uint8Array, sig: number[], offset = 0) {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return Buffer.from(bytes.subarray(start, end)).toString("latin1");
}

const ZIP_OFFICE: Record<string, DetectedFile> = {
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", ext: "pptx" },
};

const TEXT_TYPES: Record<string, DetectedFile> = {
  txt: { mime: "text/plain", ext: "txt" },
  csv: { mime: "text/csv", ext: "csv" },
  eml: { mime: "message/rfc822", ext: "eml" },
};

function looksLikeText(bytes: Uint8Array) {
  const sample = bytes.subarray(0, 4096);
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32)) return false;
  }
  return true;
}

export function detectAllowedFile(bytes: Uint8Array, fileName: string): DetectedFile | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";

  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return { mime: "application/pdf", ext: "pdf" };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return { mime: "image/gif", ext: "gif" };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return { mime: "image/tiff", ext: "tif" };
  }
  if (ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    if (/^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(brand)) return { mime: "image/heic", ext: "heic" };
    if (/^(isom|iso2|mp41|mp42|avc1|M4V )$/.test(brand)) return { mime: "video/mp4", ext: "mp4" };
    if (brand === "qt  ") return { mime: "video/quicktime", ext: "mov" };
  }
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && ZIP_OFFICE[ext]) return ZIP_OFFICE[ext];
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    if (ext === "doc") return { mime: "application/msword", ext: "doc" };
    if (ext === "xls") return { mime: "application/vnd.ms-excel", ext: "xls" };
    if (ext === "msg") return { mime: "application/vnd.ms-outlook", ext: "msg" };
  }
  if (TEXT_TYPES[ext] && looksLikeText(bytes)) return TEXT_TYPES[ext];
  return null;
}

export const ALLOWED_UPLOAD_SUMMARY =
  "PDF, images (JPG, PNG, HEIC, WEBP, GIF, TIFF), MP4/MOV video, Word, Excel, PowerPoint, Outlook .msg, .eml, TXT or CSV";

export const ALLOWED_UPLOAD_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.gif,.tif,.tiff,.mp4,.mov,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.msg,.eml,.txt,.csv";
