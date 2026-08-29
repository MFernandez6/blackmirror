import { jsPDF } from "jspdf";
import {
  CATEGORY_META,
  INDICATOR_BY_TYPE,
  SEVERITY_META,
} from "@/lib/inspection/indicators";
import type { LocalInspection, LocalItem, LocalPhoto } from "@/lib/offline/types";

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return blobToDataUrl(blob);
  } catch {
    return null;
  }
}

export async function buildInspectionPdf(opts: {
  inspection: LocalInspection;
  items: LocalItem[];
  photos: LocalPhoto[];
}): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = 52;

  const ink = "#0F1C2E";
  const gold = "#C6A85B";
  const slate = "#5C6570";

  doc.setFillColor(15, 28, 46);
  doc.rect(0, 0, pageW, 72, "F");
  doc.setTextColor(198, 168, 91);
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text("BLACKLINE PUBLIC ADJUSTERS LLC", margin, 32);
  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  doc.setTextColor(244, 244, 244);
  doc.text("BLACKMIRROR  FIELD INSPECTION REPORT", margin, 50);

  y = 100;
  doc.setTextColor(ink);
  doc.setFont("courier", "bold");
  doc.setFontSize(18);
  doc.text(opts.inspection.claimNumber, margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(slate);
  doc.text(opts.inspection.propertyAddress, margin, y);
  y += 14;
  doc.text(
    `${opts.inspection.county} County  ·  ${opts.inspection.zipCode}`,
    margin,
    y
  );
  y += 14;
  doc.text(
    `Peril protocol: ${opts.inspection.perilTemplate}   Inspected: ${new Date(
      opts.inspection.startedAt
    ).toLocaleString()}   Adjuster: ${opts.inspection.adjusterName}`,
    margin,
    y
  );

  y += 22;
  doc.setDrawColor(gold);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageW - margin, y);
  y += 22;

  const present = opts.items.filter((i) => i.presence === "PRESENT");
  const absent = opts.items.filter((i) => i.presence === "NOT_PRESENT");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(ink);
  doc.text("Positive indicators", margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const wrap = (text: string) =>
    doc.splitTextToSize(text, pageW - margin * 2) as string[];

  const ensureSpace = (h: number) => {
    if (y + h > 740) {
      doc.addPage();
      y = 56;
    }
  };

  if (!present.length) {
    doc.setTextColor(slate);
    doc.text("None marked present.", margin, y);
    y += 16;
  }

  for (const item of present) {
    const def = INDICATOR_BY_TYPE[item.indicatorType];
    const sev = item.severity ? SEVERITY_META[item.severity].label : "—";
    const conf = item.confidence ?? "—";
    const cat = CATEGORY_META[item.category].label;
    const line = `${cat} / ${def?.label ?? item.indicatorType}  ·  ${sev}  ·  ${conf}`;
    const note = item.notes?.trim() ? `Note: ${item.notes.trim()}` : "";
    const gps =
      item.gpsLat != null && item.gpsLng != null
        ? `GPS ${item.gpsLat.toFixed(5)}, ${item.gpsLng.toFixed(5)}`
        : "";
    const block = [line, note, gps].filter(Boolean).join("\n");
    const lines = wrap(block);
    ensureSpace(lines.length * 13 + 10);
    doc.setTextColor(ink);
    doc.text(lines, margin, y);
    y += lines.length * 13 + 8;
  }

  y += 8;
  ensureSpace(40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Indicators not present", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(slate);
  const absentLabels = absent
    .map((i) => INDICATOR_BY_TYPE[i.indicatorType]?.label)
    .filter(Boolean)
    .join("; ");
  const absentLines = wrap(absentLabels || "None marked.");
  ensureSpace(absentLines.length * 13 + 8);
  doc.text(absentLines, margin, y);
  y += absentLines.length * 13 + 18;

  const narrative =
    opts.inspection.narrativeFinal || opts.inspection.narrativeDraft;
  if (narrative) {
    ensureSpace(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(ink);
    doc.text("Scope / damage narrative", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const nLines = wrap(narrative);
    for (const line of nLines) {
      ensureSpace(14);
      doc.text(line, margin, y);
      y += 13;
    }
    y += 12;
  }

  const photosWithSrc = opts.photos.filter((p) => p.blob || p.url);
  if (photosWithSrc.length) {
    doc.addPage();
    y = 56;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(ink);
    doc.text("Photo log", margin, y);
    y += 18;

    const cellW = (pageW - margin * 2 - 12) / 2;
    const cellH = 168;
    let col = 0;

    for (const photo of photosWithSrc) {
      if (y + cellH > 740) {
        doc.addPage();
        y = 56;
        col = 0;
      }
      const x = margin + col * (cellW + 12);
      let dataUrl: string | null = null;
      if (photo.blob) dataUrl = await blobToDataUrl(photo.blob);
      else if (photo.url) dataUrl = await urlToDataUrl(photo.url);

      doc.setDrawColor(200);
      doc.rect(x, y, cellW, cellH - 36);
      if (dataUrl) {
        try {
          doc.addImage(dataUrl, "JPEG", x + 4, y + 4, cellW - 8, cellH - 48);
        } catch {
          doc.setFontSize(8);
          doc.text("Image unavailable", x + 8, y + 24);
        }
      }
      const item = opts.items.find((i) => i.id === photo.inspectionItemId);
      const caption =
        photo.caption ||
        INDICATOR_BY_TYPE[item?.indicatorType ?? ""]?.label ||
        "Field photo";
      const gps =
        photo.exifData?.GPSLatitude != null &&
        photo.exifData?.GPSLongitude != null
          ? `${photo.exifData.GPSLatitude.toFixed(5)}, ${photo.exifData.GPSLongitude.toFixed(5)}`
          : "";
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(ink);
      const cap = wrap(`${caption}${gps ? `  ·  ${gps}` : ""}`);
      doc.text(cap.slice(0, 2), x, y + cellH - 22);

      col += 1;
      if (col === 2) {
        col = 0;
        y += cellH + 8;
      }
    }
  }

  const blob = doc.output("blob");
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
