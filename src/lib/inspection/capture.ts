import piexif from "piexifjs";
import type { PhotoExif } from "@/lib/offline/types";

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function stampJpegExif(
  blob: Blob,
  gps: { lat: number; lng: number } | null,
  capturedAt: Date
): Promise<{ blob: Blob; exif: PhotoExif }> {
  const exif: PhotoExif = {
    DateTimeOriginal: capturedAt.toISOString(),
    GPSLatitude: gps?.lat,
    GPSLongitude: gps?.lng,
    Make: "BLACKMIRROR",
    Model: "Field Capture",
    stamped: true,
  };

  const piexifLib = piexif;
  if (!piexifLib) {
    return { blob, exif };
  }

  try {
    const dataUrl = await toDataUrl(blob);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dt = `${capturedAt.getFullYear()}:${pad(capturedAt.getMonth() + 1)}:${pad(capturedAt.getDate())} ${pad(capturedAt.getHours())}:${pad(capturedAt.getMinutes())}:${pad(capturedAt.getSeconds())}`;

    const zeroth: Record<number, unknown> = {};
    const exifIfd: Record<number, unknown> = {};
    const gpsIfd: Record<number, unknown> = {};

    zeroth[piexifLib.ImageIFD.DateTime] = dt;
    zeroth[piexifLib.ImageIFD.Make] = "BLACKMIRROR";
    zeroth[piexifLib.ImageIFD.Software] = "BLACKMIRROR Field";
    exifIfd[piexifLib.ExifIFD.DateTimeOriginal] = dt;
    exifIfd[piexifLib.ExifIFD.DateTimeDigitized] = dt;

    if (gps) {
      gpsIfd[piexifLib.GPSIFD.GPSLatitudeRef] = gps.lat >= 0 ? "N" : "S";
      gpsIfd[piexifLib.GPSIFD.GPSLatitude] = piexifLib.GPSHelper.degToDmsRational(
        Math.abs(gps.lat)
      );
      gpsIfd[piexifLib.GPSIFD.GPSLongitudeRef] = gps.lng >= 0 ? "E" : "W";
      gpsIfd[piexifLib.GPSIFD.GPSLongitude] = piexifLib.GPSHelper.degToDmsRational(
        Math.abs(gps.lng)
      );
    }

    const bytes = piexifLib.dump({ "0th": zeroth, Exif: exifIfd, GPS: gpsIfd });
    const stamped = piexifLib.insert(bytes, dataUrl);
    return { blob: dataUrlToBlob(stamped), exif };
  } catch {
    return { blob, exif };
  }
}

export async function blobToJpeg(
  source: Blob | HTMLCanvasElement,
  quality = 0.88
): Promise<Blob> {
  if (source instanceof Blob && source.type === "image/jpeg") return source;
  const canvas =
    source instanceof HTMLCanvasElement
      ? source
      : await blobToCanvas(source);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("JPEG encode failed"))),
      "image/jpeg",
      quality
    );
  });
}

/** Claude downsamples past 1568px anyway; send a smaller copy for analysis, keep the original for the vault. */
const ANALYSIS_MAX_EDGE = 1568;

export async function analysisImage(blob: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob);
    const longEdge = Math.max(bitmap.width, bitmap.height);
    if (longEdge <= ANALYSIS_MAX_EDGE) {
      bitmap.close();
      return blob;
    }
    const scale = ANALYSIS_MAX_EDGE / longEdge;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return blob;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const small = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    return small ?? blob;
  } catch {
    return blob;
  }
}

export function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image decode failed"));
    };
    img.src = url;
  });
}
