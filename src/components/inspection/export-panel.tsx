"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildInspectionPdf, downloadBlob } from "@/lib/pdf/report";
import type { LocalInspection, LocalItem, LocalPhoto } from "@/lib/offline/types";

export function ExportPanel({
  inspection,
  items,
  photos,
}: {
  inspection: LocalInspection;
  items: LocalItem[];
  photos: LocalPhoto[];
}) {
  const [busy, setBusy] = useState(false);

  async function exportPdf() {
    setBusy(true);
    try {
      const blob = await buildInspectionPdf({ inspection, items, photos });
      const name = `${inspection.claimNumber}-inspection.pdf`;
      downloadBlob(blob, name);
      toast("Report downloaded");
    } catch (err) {
      toast(err instanceof Error ? err.message : "PDF failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-28 sm:px-6 lg:pb-8">
      <p className="eyebrow">Work product</p>
      <h2 className="mt-2 font-serif text-2xl">Export report</h2>
      <p className="mt-2 text-sm text-brand-slate">
        PDF uses BLACKLINE claim numbering, a photo grid with captions, and the
        adopted narrative. Generation runs on-device so it works offline.
      </p>
      <dl className="mt-6 space-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-brand-slate">
        <div className="flex justify-between border-b border-white/10 py-2">
          <dt>Claim</dt>
          <dd className="text-brand-gold">{inspection.claimNumber}</dd>
        </div>
        <div className="flex justify-between border-b border-white/10 py-2">
          <dt>Photos</dt>
          <dd className="text-brand-white">{photos.length}</dd>
        </div>
        <div className="flex justify-between border-b border-white/10 py-2">
          <dt>Status</dt>
          <dd className="text-brand-white">{inspection.status}</dd>
        </div>
      </dl>
      <Button
        variant="solid"
        className="mt-6 h-12 w-full"
        disabled={busy}
        onClick={() => void exportPdf()}
      >
        {busy ? "Building PDF…" : "Download PDF"}
      </Button>
    </div>
  );
}
