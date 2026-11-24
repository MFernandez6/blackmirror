"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/ui/error-banner";
import { openClaimInspection } from "@/lib/offline/open-claim";
import type { CachedClaim } from "@/lib/offline/types";

export function StartInspection() {
  const router = useRouter();
  const { data: session } = useSession();
  const [claimNumber, setClaimNumber] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function startInspection() {
    if (!session?.user) return;
    if (!navigator.onLine) {
      setError("Need signal to find the BLACKBOX file. Look it up before you lose coverage.");
      return;
    }
    const trimmed = claimNumber.trim();
    if (!trimmed) {
      setError("Enter the claim number from BLACKBOX.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/claims/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimNumber: trimmed }),
      });
      const json = (await res.json().catch(() => null)) as
        | (CachedClaim & { message?: string; error?: string })
        | null;
      if (!res.ok || !json || !("id" in json) || !json.id) {
        setError(
          json?.message ||
            (json?.error === "CLAIM_NOT_FOUND"
              ? "No open file with that number."
              : "Unable to open the inspection.")
        );
        return;
      }
      toast(`Opened ${json.claimNumber}`);
      const inspectionId = await openClaimInspection({
        claim: json,
        adjusterId: session.user.id,
        adjusterName: session.user.name ?? "Adjuster",
      });
      router.push(`/inspections/${inspectionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open the inspection");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-5 pb-safe sm:px-6">
      <p className="eyebrow">Initial site visit</p>
      <h1 className="mt-2 font-serif text-2xl tracking-wide sm:text-3xl">
        Start an inspection
      </h1>
      <p className="mt-2 text-sm text-brand-slate">
        Use the claim number BLACKBOX already issued. This screen does not open
        a new file.
      </p>

      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError("")} className="mt-4" />
      ) : null}

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void startInspection();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="claimNumber">Claim number</Label>
          <Input
            id="claimNumber"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="BL-26-0001"
            value={claimNumber}
            onChange={(e) => setClaimNumber(e.target.value)}
          />
        </div>
        <Button type="submit" className="h-12 w-full" disabled={busy}>
          {busy ? "Looking up…" : "Start inspection"}
        </Button>
      </form>
    </div>
  );
}
