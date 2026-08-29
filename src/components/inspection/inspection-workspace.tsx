"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  ChevronLeft,
  ClipboardList,
  FileText,
} from "lucide-react";
import {
  CATEGORY_META,
  defaultCoverageTab,
  INDICATOR_BY_TYPE,
  SEVERITY_META,
  isItemRequired,
  type CoverageTabId,
  type InspectionCategory,
  type Presence,
  type Severity,
} from "@/lib/inspection/indicators";
import { generateNarrative } from "@/lib/inspection/narrative";
import {
  applyPresenceDefaults,
  getInspectionItems,
  getInspectionPhotos,
  getItemPhotos,
  getLocalInspection,
  ensureChecklistItems,
  markItemsNotPresent,
  patchInspection,
  patchItem,
} from "@/lib/offline/repo";
import { runSync } from "@/lib/offline/sync";
import type { LocalInspection, LocalItem, LocalPhoto } from "@/lib/offline/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CaptureFlow } from "@/components/inspection/capture-flow";
import { VoiceNotes } from "@/components/inspection/voice-notes";
import { ExportPanel } from "@/components/inspection/export-panel";
import { ChecklistPanel } from "@/components/inspection/checklist-panel";
import { getCurrentPosition } from "@/lib/inspection/geo";

type Tab = "checklist" | "capture" | "scope" | "export";

export function InspectionWorkspace({ inspectionId }: { inspectionId: string }) {
  const router = useRouter();
  const [inspection, setInspection] = useState<LocalInspection | null>(null);
  const [items, setItems] = useState<LocalItem[]>([]);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [coverageTab, setCoverageTab] = useState<CoverageTabId>("DWELLING");
  const [tab, setTab] = useState<Tab>("checklist");
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [captureItemId, setCaptureItemId] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);

  const reload = useCallback(async () => {
    const row = await getLocalInspection(inspectionId);
    if (row) await ensureChecklistItems(inspectionId, row.perilTemplate);
    const list = await getInspectionItems(inspectionId);
    const shots = await getInspectionPhotos(inspectionId);
    setInspection(row ?? null);
    setItems(list);
    setPhotos(shots);
  }, [inspectionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (inspection) setCoverageTab(defaultCoverageTab(inspection.perilTemplate));
  }, [inspection?.id]);

  const skippedCoverages = inspection?.skippedCoverages ?? [];
  const skippedSystems = inspection?.skippedSystems ?? [];
  const required = items.filter((i) =>
    isItemRequired(i.category, skippedCoverages, skippedSystems)
  );
  const answered = required.filter((i) => i.presence !== "UNSET").length;
  const present = items.filter((i) => i.presence === "PRESENT").length;
  const openItem = items.find((i) => i.id === openItemId) ?? null;

  async function setPresence(item: LocalItem, presence: Presence) {
    const defaults = applyPresenceDefaults(presence, item);
    const gps = presence === "PRESENT" ? await getCurrentPosition() : null;
    await patchItem(item.id, {
      presence,
      ...defaults,
      gpsLat: gps?.lat ?? item.gpsLat,
      gpsLng: gps?.lng ?? item.gpsLng,
      capturedAt: presence === "PRESENT" ? new Date().toISOString() : item.capturedAt,
    });
    await reload();
    if (presence === "PRESENT") setOpenItemId(item.id);
  }

  async function updateOpen(
    patch: Parameters<typeof patchItem>[1]
  ) {
    if (!openItem) return;
    await patchItem(openItem.id, patch);
    await reload();
  }

  async function saveNarrative(text: string, finalize: boolean) {
    if (!inspection) return;
    await patchInspection(inspection.id, {
      narrativeDraft: text,
      narrativeFinal: finalize ? text : inspection.narrativeFinal,
      status: finalize ? "COMPLETED" : inspection.status,
      completedAt: finalize ? new Date().toISOString() : inspection.completedAt,
    });
    await reload();
    void runSync();
  }

  const draft = useMemo(() => {
    if (!inspection) return "";
    const skippedC = inspection.skippedCoverages ?? [];
    const skippedS = inspection.skippedSystems ?? [];
    return generateNarrative({
      claimNumber: inspection.claimNumber,
      address: inspection.propertyAddress,
      peril: inspection.perilTemplate,
      inspectedAt: inspection.startedAt,
      adjusterName: inspection.adjusterName,
      items: items.filter((i) => {
        if (i.presence === "PRESENT" && i.adjusterConfirmed) return true;
        if (i.presence !== "NOT_PRESENT") return false;
        return isItemRequired(i.category, skippedC, skippedS);
      }),
    });
  }, [inspection, items]);

  if (!inspection) {
    return (
      <div className="px-4 py-10 font-mono text-[10px] uppercase tracking-[0.2em] text-brand-slate">
        Loading session…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-2 border-b border-white/10 px-3 py-3">
        <button
          type="button"
          onClick={() => router.push("/inspections")}
          className="touch-target mt-0.5 text-brand-slate"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm tracking-wide text-brand-gold">
            {inspection.claimNumber}
          </p>
          <p className="truncate text-xs text-brand-slate">
            {inspection.propertyAddress}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-brand-slate">
            {answered}/{required.length} logged · {present} finding
            {present === 1 ? "" : "s"} ·{" "}
            {items.filter((i) => i.adjusterConfirmed && i.presence === "PRESENT").length}{" "}
            confirmed
          </p>
        </div>
      </div>

      {tab === "checklist" ? (
        <ChecklistPanel
          peril={inspection.perilTemplate}
          items={items}
          photos={photos}
          tab={coverageTab}
          skippedCoverages={skippedCoverages}
          skippedSystems={skippedSystems}
          onTab={setCoverageTab}
          onPresence={(item, presence) => void setPresence(item, presence)}
          onOpen={(item) => setOpenItemId(item.id)}
          onMarkRestNotPresent={(ids) => {
            void (async () => {
              await markItemsNotPresent(ids);
              await reload();
            })();
          }}
          onSkipCoverage={(id, skip) => {
            const next = skip
              ? Array.from(new Set([...skippedCoverages, id]))
              : skippedCoverages.filter((c) => c !== id);
            void patchInspection(inspection.id, { skippedCoverages: next }).then(
              () => reload()
            );
          }}
          onSkipSystem={(category, skip) => {
            const next = skip
              ? Array.from(new Set([...skippedSystems, category]))
              : skippedSystems.filter((c) => c !== category);
            void patchInspection(inspection.id, { skippedSystems: next }).then(
              () => reload()
            );
          }}
        />
      ) : null}

      {tab === "capture" ? (
        <div className="flex flex-1 flex-col overflow-y-auto pb-28">
          <div className="px-4 py-4">
            <Button
              variant="solid"
              className="h-12 w-full"
              onClick={() => {
                setCaptureItemId(null);
                setCaptureOpen(true);
              }}
            >
              Capture photo
            </Button>
            <p className="mt-2 text-xs text-brand-slate">
              Shutter first. Date, reason, and location next. AI is a draft you
              confirm before the vault write.
            </p>
          </div>
          <CaptureList
            items={items.filter((i) => i.presence === "PRESENT")}
            photos={photos}
            onCapture={(id) => {
              setCaptureItemId(id);
              setCaptureOpen(true);
            }}
          />
        </div>
      ) : null}

      {tab === "scope" ? (
        <NarrativeEditor
          value={inspection.narrativeFinal || inspection.narrativeDraft || draft}
          generated={draft}
          onSave={(text, finalize) => void saveNarrative(text, finalize)}
        />
      ) : null}

      {tab === "export" ? (
        <ExportPanel
          inspection={inspection}
          items={items.filter((i) => {
            if (i.presence === "PRESENT" && i.adjusterConfirmed) return true;
            if (i.presence !== "NOT_PRESENT") return false;
            return isItemRequired(i.category, skippedCoverages, skippedSystems);
          })}
          photos={photos}
        />
      ) : null}

      {openItem ? (
        <ItemSheet
          item={openItem}
          onClose={() => setOpenItemId(null)}
          onChange={(patch) => void updateOpen(patch)}
          onCamera={() => {
            setCaptureItemId(openItem.id);
            setCaptureOpen(true);
          }}
        />
      ) : null}

      {captureOpen ? (
        <CaptureFlow
          inspectionId={inspectionId}
          itemId={captureItemId}
          onClose={() => {
            setCaptureOpen(false);
            setCaptureItemId(null);
          }}
          onComplete={async () => {
            await reload();
            void runSync();
          }}
        />
      ) : null}

      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-lg -translate-x-1/2 border-t border-white/10 bg-[#05070b] pb-safe">
        <div className="grid grid-cols-4">
          {(
            [
              ["checklist", ClipboardList, "File"],
              ["capture", Camera, "Photo"],
              ["scope", FileText, "Scope"],
              ["export", Check, "Export"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] touch-manipulation",
                tab === id ? "text-brand-gold" : "text-brand-slate"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function CaptureList({
  items,
  photos,
  onCapture,
}: {
  items: LocalItem[];
  photos: LocalPhoto[];
  onCapture: (id: string) => void;
}) {
  if (!items.length) {
    return (
      <p className="px-4 py-10 text-sm text-brand-slate">
        Mark indicators present first, then attach photos.
      </p>
    );
  }
  return (
    <ul className="flex-1 overflow-y-auto pb-28">
      {items.map((item) => {
        const def = INDICATOR_BY_TYPE[item.indicatorType];
        const count = photos.filter((p) => p.inspectionItemId === item.id).length;
        return (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4"
          >
            <div className="min-w-0">
              <p className="text-sm">{def?.label}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-slate">
                {count} photo{count === 1 ? "" : "s"}
              </p>
            </div>
            <Button size="sm" onClick={() => onCapture(item.id)}>
              Capture
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function ItemSheet({
  item,
  onClose,
  onChange,
  onCamera,
}: {
  item: LocalItem;
  onClose: () => void;
  onChange: (patch: Parameters<typeof patchItem>[1]) => void;
  onCamera: () => void;
}) {
  const def = INDICATOR_BY_TYPE[item.indicatorType];
  const [notes, setNotes] = useState(item.notes ?? "");
  const [measurement, setMeasurement] = useState(
    item.measurementValue != null ? String(item.measurementValue) : ""
  );
  const [itemPhotos, setItemPhotos] = useState<LocalPhoto[]>([]);

  useEffect(() => {
    void getItemPhotos(item.id).then(setItemPhotos);
  }, [item.id]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70">
      <button className="h-16 w-full" type="button" onClick={onClose} aria-label="Close" />
      <div className="max-h-[85dvh] overflow-y-auto border-t border-white/10 bg-[#05070b] px-4 pt-4 pb-safe">
        <p className="eyebrow">{CATEGORY_META[item.category].label}</p>
        <h2 className="mt-1 font-serif text-xl tracking-wide">{def?.label}</h2>
        {def?.why ? (
          <p className="mt-3 text-xs leading-relaxed text-brand-white/80">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-gold">
              Why it matters
            </span>
            <span className="mt-1 block">{def.why}</span>
          </p>
        ) : null}
        {def?.denial ? (
          <p className="mt-3 border border-denied/30 bg-denied-muted px-3 py-2 text-xs leading-relaxed text-denied-soft">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em]">
              Carrier will argue
            </span>
            <span className="mt-1 block">{def.denial}</span>
          </p>
        ) : null}
        {def?.photo ? (
          <p className="mt-3 text-xs leading-relaxed text-brand-slate">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-gold">
              Photograph
            </span>
            <span className="mt-1 block">{def.photo}</span>
          </p>
        ) : null}
        {item.aiRationale ? (
          <div className="mt-3 border border-brand-gold/25 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-gold">
              AI rationale {item.adjusterConfirmed ? "(confirmed)" : "(draft)"}
            </p>
            <p className="mt-1 text-xs text-brand-white/85">{item.aiRationale}</p>
            {item.aiSuggestedIndicator &&
            item.aiSuggestedIndicator !== item.indicatorType ? (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-brand-slate">
                Model suggested {item.aiSuggestedIndicator}; adjuster adopted{" "}
                {item.indicatorType}
              </p>
            ) : null}
            {!item.adjusterConfirmed ? (
              <Button
                variant="solid"
                className="mt-3 h-11 w-full"
                onClick={() =>
                  onChange({
                    adjusterConfirmed: true,
                    adjusterFinalCategory: item.category,
                    presence: "PRESENT",
                  })
                }
              >
                Confirm finding
              </Button>
            ) : null}
          </div>
        ) : null}

        <p className="eyebrow mt-5 mb-2">Severity</p>
        <div className="grid grid-cols-4 gap-1">
          {(["MINOR", "MODERATE", "SEVERE", "CRITICAL"] as Severity[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ severity: s })}
              className={cn(
                "h-11 font-mono text-[9px] font-bold uppercase tracking-[0.12em] touch-manipulation",
                item.severity === s
                  ? SEVERITY_META[s].className
                  : "border border-white/15 text-brand-slate"
              )}
            >
              {SEVERITY_META[s].label}
            </button>
          ))}
        </div>

        <p className="eyebrow mt-5 mb-2">Confidence</p>
        <div className="grid grid-cols-2 gap-2">
          {(["CONFIRMED", "SUSPECTED"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ confidence: c })}
              className={cn(
                "h-11 border font-mono text-[10px] font-bold uppercase tracking-[0.16em]",
                item.confidence === c
                  ? "border-brand-gold text-brand-gold"
                  : "border-white/15 text-brand-slate"
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {def?.unit ? (
          <label className="mt-5 block">
            <span className="eyebrow">Measurement ({def.unit})</span>
            <input
              className="mt-2 h-12 w-full border border-white/15 bg-[#05070b] px-3 text-base"
              inputMode="decimal"
              value={measurement}
              onChange={(e) => setMeasurement(e.target.value)}
              onBlur={() => {
                const n = Number(measurement);
                onChange({
                  measurementValue: Number.isFinite(n) ? n : null,
                  measurementUnit: def.unit ?? null,
                });
              }}
            />
          </label>
        ) : null}

        <p className="eyebrow mt-5 mb-2">Field notes</p>
        <VoiceNotes
          value={notes}
          onChange={(v) => {
            setNotes(v);
            onChange({ notes: v });
          }}
        />

        <div className="mt-4 flex gap-2">
          <Button className="h-12 flex-1 gap-2" onClick={onCamera}>
            <Camera className="h-4 w-4" /> Photo
          </Button>
          <Button
            variant="solid"
            className="h-12 flex-1"
            onClick={() => {
              onChange({ notes });
              onClose();
            }}
          >
            Done
          </Button>
        </div>

        {itemPhotos.length ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {itemPhotos.map((p) => (
              <div key={p.id} className="aspect-square border border-white/10 bg-black">
                {/* blob preview via object url when present */}
                <PhotoThumb photo={p} />
              </div>
            ))}
          </div>
        ) : null}

        {item.gpsLat != null && item.gpsLng != null ? (
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-brand-slate">
            GPS {item.gpsLat.toFixed(5)}, {item.gpsLng.toFixed(5)}
          </p>
        ) : null}
        <div className="h-4" />
      </div>
    </div>
  );
}

function PhotoThumb({ photo }: { photo: LocalPhoto }) {
  const [src, setSrc] = useState<string | null>(photo.url || null);
  useEffect(() => {
    if (photo.blob) {
      const url = URL.createObjectURL(photo.blob);
      setSrc(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [photo.blob]);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-full w-full object-cover" />
  );
}

function NarrativeEditor({
  value,
  generated,
  onSave,
}: {
  value: string;
  generated: string;
  onSave: (text: string, finalize: boolean) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4 pb-28">
      <p className="eyebrow">Draft scope</p>
      <p className="mt-2 text-sm text-brand-slate">
        Generated from present indicators. Edit before you finalize.
      </p>
      <Textarea
        className="mt-4 min-h-[50dvh] text-sm leading-relaxed"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex gap-2">
        <Button
          className="h-12 flex-1"
          onClick={() => {
            setText(generated);
            onSave(generated, false);
          }}
        >
          Regenerate
        </Button>
        <Button
          variant="solid"
          className="h-12 flex-1"
          onClick={() => onSave(text, true)}
        >
          Finalize
        </Button>
      </div>
    </div>
  );
}
