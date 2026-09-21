"use client";

import { toast } from "sonner";
import { formatDefenseDraft } from "@/lib/ai/format-defense-draft";
import type { AiDraft } from "@/lib/offline/types";

export function DefenseDraft({
  analysis,
  confirmed,
}: {
  analysis: AiDraft;
  confirmed?: boolean;
}) {
  const draft = formatDefenseDraft(analysis);
  const hasDefense =
    Boolean(analysis.affirmativeDefense?.trim()) ||
    Boolean(analysis.denialRebuttal?.trim());

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      toast("Drafting notes copied");
    } catch {
      toast("Could not copy — select the text instead");
    }
  }

  return (
    <div className="space-y-3">
      {analysis.visualRationale ? (
        <p className="text-sm leading-relaxed text-brand-white/90">
          {analysis.visualRationale}
        </p>
      ) : null}

      {analysis.likelyDenial ? (
        <div className="rounded-md border border-denied/30 bg-denied-muted px-3 py-2">
          <p className="font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-denied-soft">
            Carrier will likely argue
          </p>
          <p className="mt-1 text-xs leading-relaxed text-denied-soft">
            {analysis.likelyDenial}
          </p>
        </div>
      ) : null}

      {analysis.affirmativeDefense ? (
        <div className="rounded-md border border-brand-gold/30 bg-brand-gold/5 px-3 py-2">
          <p className="font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-brand-gold">
            Affirmative defense {confirmed ? "(confirmed)" : "(Claude draft)"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-brand-white/85">
            {analysis.affirmativeDefense}
          </p>
        </div>
      ) : null}

      {analysis.denialRebuttal ? (
        <div className="rounded-md border border-brand-amber/30 bg-brand-amber/5 px-3 py-2">
          <p className="font-sans text-[9px] font-bold uppercase tracking-[0.16em] text-brand-amber">
            Rebuttal for the file {confirmed ? "(confirmed)" : "(Claude draft)"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-brand-white/85">
            {analysis.denialRebuttal}
          </p>
        </div>
      ) : null}

      {hasDefense ? (
        <button
          type="button"
          onClick={() => void copy()}
          className="h-10 w-full rounded-md border border-brand-white/15 font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold touch-manipulation"
        >
          Copy drafting notes
        </button>
      ) : null}
    </div>
  );
}
