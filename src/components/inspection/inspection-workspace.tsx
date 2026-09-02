"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  ChevronLeft,
  ClipboardList,
  FileText,
  Trash2,
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
  getLocalInspection,
  ensureChecklistItems,
  markItemsNotPresent,
  patchInspection,
  patchItem,
  removeInspectionPhoto,
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

  async function removePhoto(photoId: string) {
    if (
      !window.confirm(
        "Remove this photo from the inspection and the BLACKBOX vault?"
      )
    ) {
      return;
    }
    await removeInspectionPhoto(photoId);
    await reload();
    void runSync();
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

  const navItems = (
    [
      ["checklist", ClipboardList, "File"],
      ["capture", Camera, "Photo"],
      ["scope", FileText, "Scope"],
      ["export", Check, "Export"],
    ] as const
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col lg:flex-row">
      <nav className="hidden w-24 shrink-0 flex-col border-r border-white/10 bg-brand-navy-deep/40 py-3 lg:flex">
        {navItems.map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 px-2 font-mono text-[9px] font-bold uppercase tracking-[0.16em] touch-manipulation",
              tab === id ? "text-brand-gold" : "text-brand-slate hover:text-brand-white"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-start gap-2 border-b border-white/10 px-3 py-3 sm:px-5">
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
        <div className="flex flex-1 flex-col overflow-y-auto pb-28 lg:pb-8">
          <div className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6">
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
            onDeletePhoto={(photoId) => void removePhoto(photoId)}
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
          photos={photos.filter((p) => p.inspectionItemId === openItem.id)}
          onClose={() => setOpenItemId(null)}
          onChange={(patch) => void updateOpen(patch)}
          onCamera={() => {
            setCaptureItemId(openItem.id);
            setCaptureOpen(true);
          }}
          onDeletePhoto={(photoId) => void removePhoto(photoId)}
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

      <nav className="sticky bottom-0 z-40 mt-auto border-t border-white/10 bg-brand-navy/95 pb-safe backdrop-blur-md lg:hidden">
        <div className="grid grid-cols-4">
          {navItems.map(([id, Icon, label]) => (
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
    </div>
  );
}

function CaptureList({
  items,
  photos,
  onCapture,
  onDeletePhoto,
}: {
  items: LocalItem[];
  photos: LocalPhoto[];
  onCapture: (id: string) => void;
  onDeletePhoto: (photoId: string) => void;
}) {
  if (!items.length) {
    return (
      <p className="px-4 py-10 text-sm text-brand-slate">
        Mark indicators present first, then attach photos.
      </p>
    );
  }
  return (
    <ul className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-0 lg:pb-0">
      {items.map((item) => {
        const def = INDICATOR_BY_TYPE[item.indicatorType];
        const shots = photos.filter((p) => p.inspectionItemId === item.id);
        return (
          <li
            key={item.id}
            className="border-b border-white/10 px-4 py-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm">{def?.label}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-slate">
                  {shots.length} photo{shots.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button size="sm" onClick={() => onCapture(item.id)}>
                Capture
              </Button>
            </div>
            {shots.length ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {shots.map((photo) => (
                  <PhotoThumb
                    key={photo.id}
                    photo={photo}
                    onDelete={() => onDeletePhoto(photo.id)}
                  />
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function ItemSheet({
  item,
  photos,
  onClose,
  onChange,
  onCamera,
  onDeletePhoto,
}: {
  item: LocalItem;
  photos: LocalPhoto[];
  onClose: () => void;
  onChange: (patch: Parameters<typeof patchItem>[1]) => void;
  onCamera: () => void;
  onDeletePhoto: (photoId: string) => void;
}) {
  const def = INDICATOR_BY_TYPE[item.indicatorType];
  const [notes, setNotes] = useState(item.notes ?? "");
  const [measurement, setMeasurement] = useState(
    item.measurementValue != null ? String(item.measurementValue) : ""
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 md:items-center md:justify-center md:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full overflow-y-auto border-t border-brand-white/10 bg-brand-navy px-4 pt-4 pb-safe md:max-w-xl md:rounded-lg md:border md:shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
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
          <p className="mt-3 rounded-md border border-denied/30 bg-denied-muted px-3 py-2 text-xs leading-relaxed text-denied-soft">
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
          <div className="mt-3 rounded-md border border-brand-gold/25 p-3">
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
                "h-11 rounded-md font-mono text-[9px] font-bold uppercase tracking-[0.12em] touch-manipulation",
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
                "h-11 rounded-md border font-mono text-[10px] font-bold uppercase tracking-[0.16em]",
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
              className="mt-2 h-12 w-full rounded-md border border-brand-white/15 bg-brand-navy-deep/50 px-3 text-base"
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

        {photos.length ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <PhotoThumb
                key={p.id}
                photo={p}
                onDelete={() => onDeletePhoto(p.id)}
              />
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

function PhotoThumb({
  photo,
  onDelete,
}: {
  photo: LocalPhoto;
  onDelete?: () => void;
}) {
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
    <div className="relative aspect-square overflow-hidden rounded-md border border-white/10 bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
      {onDelete ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-md border border-denied/40 bg-black/70 text-denied-soft touch-manipulation"
          aria-label="Delete photo"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-y-auto px-4 py-4 pb-28 sm:px-6 lg:pb-8">
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
