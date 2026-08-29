"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CameraCapture } from "@/components/inspection/camera-capture";
import {
  INSPECTION_REASONS,
  LOCATION_OPTIONS,
  type InspectionReason,
} from "@/lib/inspection/catalog";
import {
  CATEGORY_META,
  INDICATOR_BY_TYPE,
  INDICATOR_LIBRARY,
  SEVERITY_META,
  type InspectionCategory,
  type Severity,
} from "@/lib/inspection/indicators";
import {
  deleteLocalPhoto,
  getLocalInspection,
  patchItem,
  patchPhoto,
  queueCapturedPhoto,
  rememberCustomLocation,
  savePhotoAnalysis,
} from "@/lib/offline/repo";
import { runSync } from "@/lib/offline/sync";
import type { AiDraft, LocalPhoto, ReferenceMatch } from "@/lib/offline/types";
import { getCurrentPosition } from "@/lib/inspection/geo";
import { cn } from "@/lib/utils";

type Props = {
  inspectionId: string;
  itemId?: string | null;
  onClose: () => void;
  onComplete: () => Promise<void> | void;
};

type Step = "camera" | "confirm" | "review";

export function CaptureFlow({ inspectionId, itemId, onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>("camera");
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState<InspectionReason>("INITIAL_INSPECTION");
  const [customReason, setCustomReason] = useState("");
  const [location, setLocation] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [locations, setLocations] = useState<string[]>([...LOCATION_OPTIONS]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");
  const [indicatorType, setIndicatorType] = useState("");
  const [severity, setSeverity] = useState<Severity>("MODERATE");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    void getLocalInspection(inspectionId).then((row) => {
      if (row?.customLocations.length) {
        setLocations([...LOCATION_OPTIONS, ...row.customLocations]);
      }
    });
    void getCurrentPosition().then(setGps);
  }, [inspectionId]);

  const canConfirm =
    !!date &&
    !!reason &&
    (reason !== "CUSTOM" || customReason.trim().length > 1) &&
    (location || customLocation.trim().length > 1);

  const resolvedLocation = location || customLocation.trim();

  async function afterCapture(payload: {
    blob: Blob;
    annotations: LocalPhoto["annotations"];
    exif: LocalPhoto["exifData"];
    capturedAt: string;
  }) {
    const queued = await queueCapturedPhoto({
      inspectionId,
      inspectionItemId: itemId ?? null,
      blob: payload.blob,
      annotations: payload.annotations,
      exifData: payload.exif,
      capturedAt: payload.capturedAt,
      captureDate: date,
      reason,
      customReasonText: customReason || null,
      locationTag: resolvedLocation || "Pending",
      gpsLat: gps?.lat ?? payload.exif?.GPSLatitude ?? null,
      gpsLng: gps?.lng ?? payload.exif?.GPSLongitude ?? null,
    });
    setPhoto(queued);
    setStep("confirm");
  }

  async function onConfirmMeta() {
    if (!photo || !canConfirm) return;
    const loc = resolvedLocation;
    await rememberCustomLocation(inspectionId, loc);
    await patchPhoto(photo.id, {
      captureDate: date,
      reason,
      customReasonText: reason === "CUSTOM" ? customReason : null,
      locationTag: loc,
    });
    setPhoto({
      ...photo,
      captureDate: date,
      reason,
      customReasonText: reason === "CUSTOM" ? customReason : null,
      locationTag: loc,
    });

    if (!navigator.onLine) {
      toast("Queued offline — AI and vault will run when signal returns");
      await onComplete();
      onClose();
      void runSync();
      return;
    }

    setAnalyzing(true);
    try {
      const form = new FormData();
      form.set("file", photo.blob!, `${photo.id}.jpg`);
      const res = await fetch("/api/analyze-photo", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Analysis failed");
      }
      const data = (await res.json()) as {
        analysis: AiDraft;
        references: ReferenceMatch[];
      };
      await savePhotoAnalysis(photo.id, data.analysis, data.references);
      setIndicatorType(itemId ? indicatorType || data.analysis.indicatorType : data.analysis.indicatorType);
      setSeverity(data.analysis.estimatedSeverity);
      setDescription(data.analysis.visualRationale);
      setPhoto({
        ...photo,
        analysis: data.analysis,
        references: data.references,
        aiDescription: data.analysis.visualRationale,
        captureDate: date,
        reason,
        locationTag: loc,
      });
      setStep("review");
    } catch (err) {
      toast(err instanceof Error ? err.message : "AI unavailable — photo is cached");
      await onComplete();
      onClose();
    } finally {
      setAnalyzing(false);
    }
  }

  async function onSaveConfirmed() {
    if (!photo?.blob || !indicatorType) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.set("id", photo.id);
      form.set("inspectionId", inspectionId);
      if (itemId) form.set("inspectionItemId", itemId);
      form.set("file", photo.blob, `${photo.id}.jpg`);
      form.set("locationTag", photo.locationTag ?? resolvedLocation);
      form.set("captureDate", photo.captureDate);
      form.set("reason", photo.reason);
      if (photo.customReasonText) form.set("customReasonText", photo.customReasonText);
      form.set("description", description);
      form.set("adjusterConfirmed", "true");
      form.set("indicatorType", indicatorType);
      form.set("category", INDICATOR_BY_TYPE[indicatorType]?.category ?? "");
      form.set("severity", severity);
      form.set("confidence", photo.analysis?.confidence ?? "SUSPECTED");
      form.set("aiRationale", photo.analysis?.visualRationale ?? "");
      form.set("aiSuggestedIndicator", photo.analysis?.indicatorType ?? "");
      form.set(
        "similarReferenceIds",
        JSON.stringify(photo.references.map((r) => r.id))
      );
      if (photo.gpsLat != null) form.set("gpsLat", String(photo.gpsLat));
      if (photo.gpsLng != null) form.set("gpsLng", String(photo.gpsLng));

      const res = await fetch("/api/inspections/commit-photo", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Vault write failed");
      }
      const result = (await res.json()) as {
        url: string;
        storagePath: string;
        itemId: string;
        sessionId: string;
      };
      await patchPhoto(photo.id, {
        url: result.url,
        storagePath: result.storagePath,
        inspectionItemId: result.itemId,
        sessionId: result.sessionId,
        blob: null,
        uploadPending: false,
        syncStatus: "SYNCED",
        adjusterEditedDescription: description,
        dirty: false,
      });
      await patchItem(result.itemId, {
        presence: "PRESENT",
        severity,
        notes: description,
        adjusterConfirmed: true,
        adjusterFinalCategory: INDICATOR_BY_TYPE[indicatorType]?.category ?? null,
        aiSuggestedIndicator: photo.analysis?.indicatorType ?? null,
        aiRationale: photo.analysis?.visualRationale ?? null,
      });
      toast("Filed to BLACKBOX vault");
      await onComplete();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed — kept on device");
    } finally {
      setSaving(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<InspectionCategory, typeof INDICATOR_LIBRARY>();
    for (const ind of INDICATOR_LIBRARY) {
      const list = map.get(ind.category) ?? [];
      list.push(ind);
      map.set(ind.category, list);
    }
    return map;
  }, []);

  if (step === "camera") {
    return (
      <CameraCapture
        onCancel={onClose}
        onSave={async (payload) => {
          await afterCapture(payload);
        }}
      />
    );
  }

  if (step === "confirm") {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-[#05070b]">
        <div className="px-4 py-3 pt-safe">
          <p className="eyebrow">Confirm before analysis</p>
          <h2 className="mt-1 font-serif text-xl">Date / reason / location</h2>
          <p className="mt-2 text-sm text-brand-slate">
            Local only — works offline. AI and the vault wait until you confirm, then
            until you have signal.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-28">
          <Label htmlFor="captureDate">Date</Label>
          <Input
            id="captureDate"
            type="date"
            className="mt-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <p className="eyebrow mt-6 mb-2">Reason</p>
          <div className="grid grid-cols-1 gap-2">
            {INSPECTION_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={cn(
                  "min-h-11 border px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.14em]",
                  reason === r.value
                    ? "border-brand-gold text-brand-gold"
                    : "border-white/15 text-brand-slate"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          {reason === "CUSTOM" ? (
            <Input
              className="mt-2"
              placeholder="Custom reason"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
            />
          ) : null}

          <p className="eyebrow mt-6 mb-2">Location</p>
          <div className="flex flex-wrap gap-2">
            {locations.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => {
                  setLocation(loc);
                  setCustomLocation("");
                }}
                className={cn(
                  "h-11 border px-3 font-mono text-[10px] uppercase tracking-[0.12em]",
                  location === loc
                    ? "border-brand-gold text-brand-gold"
                    : "border-white/15 text-brand-slate"
                )}
              >
                {loc}
              </button>
            ))}
          </div>
          <Input
            className="mt-3"
            placeholder="Custom location (property-specific)"
            value={customLocation}
            onChange={(e) => {
              setCustomLocation(e.target.value);
              setLocation("");
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 py-3 pb-safe">
          <Button
            variant="outline"
            className="h-12"
            onClick={() => {
              if (photo) void deleteLocalPhoto(photo.id);
              onClose();
            }}
          >
            Discard
          </Button>
          <Button
            variant="solid"
            className="h-12"
            disabled={!canConfirm || analyzing}
            onClick={() => void onConfirmMeta()}
          >
            {analyzing ? "Analyzing…" : "Confirm"}
          </Button>
        </div>
      </div>
    );
  }

  const analysis = photo?.analysis;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#05070b]">
      <div className="px-4 py-3 pt-safe">
        <p className="eyebrow">AI suggestion — not a determination</p>
        <h2 className="mt-1 font-serif text-xl">Review & confirm</h2>
        <p className="mt-2 text-xs text-brand-slate">
          Licensed adjuster confirms. The file records both the model output and your
          adopted finding.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-28">
        {analysis ? (
          <div className="border border-brand-gold/30 bg-brand-gold/5 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-gold">
              Suggested {CATEGORY_META[analysis.category].label} /{" "}
              {INDICATOR_BY_TYPE[analysis.indicatorType]?.label}
            </p>
            <p className="mt-2 text-sm">{analysis.visualRationale}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-brand-slate">
              {analysis.confidence} · {SEVERITY_META[analysis.estimatedSeverity].label}
            </p>
          </div>
        ) : null}

        {photo?.references.length ? (
          <div className="mt-5">
            <p className="eyebrow mb-2">Closest reference examples</p>
            <div className="space-y-3">
              {photo.references.map((ref) => (
                <div key={ref.id} className="border border-white/10 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand-gold">
                    {INDICATOR_BY_TYPE[ref.indicatorType]?.label ?? ref.indicatorType}
                    {ref.similarity
                      ? ` · ${(ref.similarity * 100).toFixed(0)}%`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-brand-white/85">{ref.description}</p>
                  <p className="mt-2 text-[11px] text-brand-slate">{ref.sourceNote}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <label className="mt-5 block">
          <span className="eyebrow">Adopted indicator</span>
          <select
            className="mt-2 h-12 w-full border border-white/15 bg-[#05070b] px-3 text-sm"
            value={indicatorType}
            onChange={(e) => setIndicatorType(e.target.value)}
          >
            {Array.from(grouped.entries()).map(([cat, list]) => (
              <optgroup key={cat} label={CATEGORY_META[cat].label}>
                {list.map((ind) => (
                  <option key={ind.type} value={ind.type}>
                    {ind.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <p className="eyebrow mt-5 mb-2">Severity</p>
        <div className="grid grid-cols-4 gap-1">
          {(["MINOR", "MODERATE", "SEVERE", "CRITICAL"] as Severity[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              className={cn(
                "h-11 font-mono text-[9px] font-bold uppercase tracking-[0.12em]",
                severity === s
                  ? SEVERITY_META[s].className
                  : "border border-white/15 text-brand-slate"
              )}
            >
              {SEVERITY_META[s].label}
            </button>
          ))}
        </div>

        <p className="eyebrow mt-5 mb-2">Description (editable)</p>
        <Textarea
          className="min-h-[140px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 py-3 pb-safe">
        <Button variant="outline" className="h-12" onClick={onClose}>
          Later
        </Button>
        <Button
          variant="solid"
          className="h-12"
          disabled={saving || !indicatorType}
          onClick={() => void onSaveConfirmed()}
        >
          {saving ? "Filing…" : "Confirm & file"}
        </Button>
      </div>
    </div>
  );
}
