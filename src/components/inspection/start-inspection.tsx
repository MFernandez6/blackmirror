"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/ui/error-banner";
import { openClaimInspection } from "@/lib/offline/open-claim";
import { suggestCountyFromZip } from "@/lib/zip-county";
import type { CachedClaim } from "@/lib/offline/types";
import type { LossType } from "@/lib/inspection/indicators";
import { useSession } from "next-auth/react";

const PERILS: LossType[] = ["WIND", "WATER", "HAIL", "FIRE", "VANDALISM", "OTHER"];

function todayIso() {
  const n = new Date();
  return [
    n.getFullYear(),
    String(n.getMonth() + 1).padStart(2, "0"),
    String(n.getDate()).padStart(2, "0"),
  ].join("-");
}

export function StartInspection() {
  const router = useRouter();
  const { data: session } = useSession();
  const [preview, setPreview] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [county, setCounty] = useState("");
  const [countyTouched, setCountyTouched] = useState(false);
  const [dateOfLoss, setDateOfLoss] = useState(todayIso);
  const [peril, setPeril] = useState<LossType>("WIND");
  const [isCatClaim, setIsCatClaim] = useState(false);
  const [lossDescription, setLossDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!navigator.onLine) return;
    void fetch("/api/claims/intake")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { previewNumber?: string } | null) => {
        if (data?.previewNumber) setPreview(data.previewNumber);
      })
      .catch(() => undefined);
  }, [online]);

  function onZipChange(value: string) {
    const next = value.replace(/[^\d-]/g, "").slice(0, 10);
    setZipCode(next);
    if (countyTouched) return;
    const suggested = suggestCountyFromZip(next);
    if (suggested) setCounty(suggested);
  }

  async function openFile() {
    if (!session?.user) return;
    if (!navigator.onLine) {
      setError(
        "Need signal to issue the next BLACKLINE number. Open the file before you lose coverage."
      );
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/claims/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
          email,
          propertyAddress,
          zipCode,
          county,
          dateOfLoss,
          lossType: peril,
          isCatClaim,
          lossDescription,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | (CachedClaim & { message?: string })
        | { error?: string; message?: string }
        | null;
      if (!res.ok || !json || !("id" in json)) {
        setError(
          json && "message" in json && json.message
            ? json.message
            : "Unable to open the file."
        );
        return;
      }
      toast(`Opened ${json.claimNumber}`);
      const inspectionId = await openClaimInspection({
        claim: json,
        adjusterId: session.user.id,
        adjusterName: session.user.name,
        peril,
      });
      router.push(`/inspections/${inspectionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open the file");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-5 pb-safe sm:px-6">
      <p className="eyebrow">Initial site visit</p>
      <h1 className="mt-2 font-serif text-2xl tracking-wide sm:text-3xl">Open a file</h1>
      <p className="mt-2 text-sm text-brand-slate">
        Inspection before BLACKBOX assignment. Issues the next Blackline PA
        number, captures enough to work the site, and leaves the rest for the
        office.
      </p>

      <div className="mt-5 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 px-3 py-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand-slate">
          Next BLACKLINE number
        </p>
        <p className="mt-1 font-mono text-lg tracking-wide text-brand-gold">
          {preview ?? "BL-YY-####"}
        </p>
        <p className="mt-1 text-xs text-brand-slate">
          Assigned when you open the file — not before.
        </p>
      </div>

      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError("")} className="mt-4" />
      ) : null}

      {!online ? (
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-severity-moderate">
          Offline — wait for signal to issue a claim number
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">Client first</Label>
          <Input
            id="firstName"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Client last</Label>
          <Input
            id="lastName"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="If you have it"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="email">Email (optional)</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="Can wait for the office"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="propertyAddress">Loss location</Label>
        <Input
          id="propertyAddress"
          autoComplete="street-address"
          placeholder="Street, city"
          value={propertyAddress}
          onChange={(e) => setPropertyAddress(e.target.value)}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="zipCode">ZIP</Label>
          <Input
            id="zipCode"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="33145"
            value={zipCode}
            onChange={(e) => onZipChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="county">County</Label>
          <Input
            id="county"
            value={county}
            onChange={(e) => {
              setCountyTouched(true);
              setCounty(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="dateOfLoss">Date of loss</Label>
        <Input
          id="dateOfLoss"
          type="date"
          value={dateOfLoss}
          onChange={(e) => setDateOfLoss(e.target.value)}
        />
      </div>

      <p className="eyebrow mt-6 mb-3">Peril</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PERILS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeril(p)}
            className={`h-11 rounded-md border font-sans text-[10px] font-bold uppercase tracking-[0.16em] touch-manipulation ${
              peril === p
                ? "border-brand-gold bg-brand-gold/15 text-brand-gold"
                : "border-brand-white/15 text-brand-slate"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <label className="mt-4 flex items-center gap-3 touch-manipulation">
        <input
          type="checkbox"
          checked={isCatClaim}
          onChange={(e) => setIsCatClaim(e.target.checked)}
          className="h-4 w-4 accent-brand-gold"
        />
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-brand-slate">
          CAT / declared event
        </span>
      </label>

      <div className="mt-4 space-y-2">
        <Label htmlFor="lossDescription">What happened (optional)</Label>
        <Input
          id="lossDescription"
          placeholder="One line is enough"
          value={lossDescription}
          onChange={(e) => setLossDescription(e.target.value)}
        />
      </div>

      <Button
        variant="solid"
        className="mt-6 h-12 w-full"
        onClick={() => void openFile()}
        disabled={busy || !online}
      >
        {busy ? "Opening file…" : "Open file and inspect"}
      </Button>
    </div>
  );
}
