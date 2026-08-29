"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { canEdit } from "@/lib/auth-client";
import { claimStatusLabel, isOpenClaimStatus } from "@/lib/inspection/labels";
import {
  cacheClaim,
  listCachedAssignedClaims,
  listLocalInspections,
} from "@/lib/offline/repo";
import { openClaimInspection } from "@/lib/offline/open-claim";
import type { CachedClaim, LocalInspection } from "@/lib/offline/types";

export function InspectionList() {
  const router = useRouter();
  const { data: session } = useSession();
  const [claims, setClaims] = useState<CachedClaim[] | null>(null);
  const [sessions, setSessions] = useState<LocalInspection[]>([]);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const localSessions = await listLocalInspections();
    setSessions(localSessions);

    if (navigator.onLine) {
      const res = await fetch("/api/claims/assigned");
      if (res.ok) {
        const data = (await res.json()) as { claims: CachedClaim[] };
        for (const claim of data.claims) {
          await cacheClaim(claim);
        }
        setClaims(data.claims);
        setFromCache(false);
        return;
      }
    }

    const cached = await listCachedAssignedClaims(session.user.id);
    setClaims(cached);
    setFromCache(true);
  }, [session?.user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openClaim(claim: CachedClaim) {
    if (!session?.user) return;
    if (!canEdit(session.user.role)) {
      setError("Viewers can review assigned files but cannot start a field session.");
      return;
    }
    setError("");
    setOpeningId(claim.id);
    try {
      const id = await openClaimInspection({
        claim,
        adjusterId: session.user.id,
        adjusterName: session.user.name,
      });
      router.push(`/inspections/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open this file");
    } finally {
      setOpeningId(null);
    }
  }

  if (!session?.user || claims === null) {
    return (
      <div className="px-4 py-10 font-mono text-[10px] uppercase tracking-[0.2em] text-brand-slate">
        Loading assigned files…
      </div>
    );
  }

  const firstName = session.user.name.split(" ")[0];
  const sessionByClaim = new Map(sessions.map((row) => [row.claimId, row]));

  return (
    <div className="flex flex-1 flex-col pb-safe">
      <div className="px-4 py-5">
        <p className="eyebrow">Assigned in BLACKBOX</p>
        <h1 className="mt-2 font-serif text-2xl tracking-wide text-brand-white">
          {firstName}&rsquo;s files
        </h1>
        <p className="mt-2 text-sm text-brand-slate">
          Pick a claim assigned to you, then start or continue the inspection.
        </p>
      </div>

      {error ? (
        <div className="px-4">
          <ErrorBanner message={error} onDismiss={() => setError("")} />
        </div>
      ) : null}

      {fromCache ? (
        <p className="px-4 pb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-brand-gold/80">
          Showing on-device cache
        </p>
      ) : null}

      {claims.length === 0 ? (
        <p className="px-4 py-8 text-sm text-brand-slate">
          No BLACKBOX files are assigned to you. If this is the first visit,
          open a new file on site.
        </p>
      ) : (
        <ul className="divide-y divide-white/10 border-y border-white/10">
          {claims.map((claim) => {
            const local = sessionByClaim.get(claim.id);
            const inProgress =
              local?.status === "IN_PROGRESS" ||
              claim.latestInspectionStatus === "IN_PROGRESS";
            const action = inProgress ? "Continue" : "Inspect";
            return (
              <li key={claim.id}>
                <button
                  type="button"
                  onClick={() => void openClaim(claim)}
                  disabled={openingId === claim.id}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left touch-manipulation disabled:opacity-60"
                >
                  <span
                    className={`h-10 w-1 shrink-0 ${
                      isOpenClaimStatus(claim.status)
                        ? "bg-brand-gold"
                        : "bg-white/20"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-sm tracking-wide text-brand-gold">
                      {claim.claimNumber}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-brand-white/85">
                      {claim.propertyAddress}
                    </span>
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-brand-slate">
                      {claim.lossType} · {claimStatusLabel(claim.status)}
                      {claim.primaryClaimant ? ` · ${claim.primaryClaimant}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-gold">
                      {openingId === claim.id ? "Opening…" : action}
                    </span>
                    <ChevronRight className="ml-auto mt-1 h-4 w-4 text-brand-slate" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="px-4 py-5">
        <Button
          variant="outline"
          className="h-12 w-full gap-2"
          onClick={() => router.push("/inspections/new")}
        >
          <Plus className="h-4 w-4" />
          First visit — open a file
        </Button>
      </div>

      {sessions.length ? (
        <div className="px-4 pb-8">
          <p className="eyebrow mb-3">On this device</p>
          <ul className="divide-y divide-white/10 border border-white/10">
            {sessions.slice(0, 8).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/inspections/${row.id}`)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left touch-manipulation"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-sm text-brand-gold">
                      {row.claimNumber}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-brand-slate">
                      {row.propertyAddress} · {row.status.replace("_", " ")}
                      {row.dirty ? " · UNSYNCED" : ""}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-brand-slate" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
