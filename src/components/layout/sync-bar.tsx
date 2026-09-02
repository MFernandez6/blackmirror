"use client";

import { useSyncStatus } from "@/components/pwa/sync-provider";
import { runSync } from "@/lib/offline/sync";
import { cn } from "@/lib/utils";

export function SyncBar() {
  const status = useSyncStatus();
  const label = !status.online
    ? "OFFLINE — session cached"
    : status.syncing
      ? "SYNCING"
      : status.pending
        ? `${status.pending} QUEUED`
        : "LIVE";

  return (
    <button
      type="button"
      onClick={() => void runSync()}
      className={cn(
        "flex w-full items-center justify-between gap-3 border-b px-4 py-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] sm:px-6",
        status.online
          ? "border-brand-white/5 bg-brand-navy-deep/40 text-brand-gold"
          : "border-severity-severe/40 bg-severity-severe/15 text-severity-moderate"
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "inline-block h-1.5 w-1.5",
            status.online
              ? "animate-gate-pulse bg-brand-amber"
              : "bg-severity-moderate"
          )}
        />
        {label}
      </span>
      {status.lastError ? (
        <span className="truncate text-denied">Sync error</span>
      ) : (
        <span className="text-brand-slate">Tap to flush</span>
      )}
    </button>
  );
}
