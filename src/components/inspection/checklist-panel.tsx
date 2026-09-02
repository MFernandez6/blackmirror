"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  CATEGORY_META,
  COVERAGE_TABS,
  INDICATOR_BY_TYPE,
  SEVERITY_META,
  isTabSkipped,
  isSystemSkipped,
  type CoverageTabId,
  type InspectionCategory,
  type LossType,
  type Presence,
  type Severity,
} from "@/lib/inspection/indicators";
import type { LocalItem, LocalPhoto } from "@/lib/offline/types";
import { cn } from "@/lib/utils";

type Props = {
  peril: LossType;
  items: LocalItem[];
  photos: LocalPhoto[];
  tab: CoverageTabId;
  skippedCoverages: CoverageTabId[];
  skippedSystems: InspectionCategory[];
  onTab: (id: CoverageTabId) => void;
  onPresence: (item: LocalItem, presence: Presence) => void;
  onOpen: (item: LocalItem) => void;
  onMarkRestNotPresent: (itemIds: string[]) => void;
  onSkipCoverage: (id: CoverageTabId, skip: boolean) => void;
  onSkipSystem: (category: InspectionCategory, skip: boolean) => void;
};

export function ChecklistPanel({
  peril,
  items,
  photos,
  tab,
  skippedCoverages,
  skippedSystems,
  onTab,
  onPresence,
  onOpen,
  onMarkRestNotPresent,
  onSkipCoverage,
  onSkipSystem,
}: Props) {
  const spec = COVERAGE_TABS.find((t) => t.id === tab) ?? COVERAGE_TABS[0];
  const [system, setSystem] = useState<InspectionCategory>(
    spec.systems?.[0] ?? spec.categories[0]
  );

  const activeCategory: InspectionCategory | null = spec.systems
    ? spec.systems.includes(system)
      ? system
      : spec.systems[0]
    : null;

  const coverageOff = isTabSkipped(tab, skippedCoverages);
  const systemOff = Boolean(
    activeCategory && isSystemSkipped(activeCategory, skippedSystems)
  );
  const listOff = coverageOff || systemOff;

  const visible = items.filter((item) => {
    if (spec.systems) return item.category === (activeCategory ?? spec.systems[0]);
    return spec.categories.includes(item.category);
  });

  const grouped = useMemo(() => {
    const map = new Map<string, LocalItem[]>();
    for (const item of visible) {
      const group = INDICATOR_BY_TYPE[item.indicatorType]?.group ?? "Findings";
      const list = map.get(group) ?? [];
      list.push(item);
      map.set(group, list);
    }
    return Array.from(map.entries());
  }, [visible]);

  const tabItems = items.filter((item) => spec.categories.includes(item.category));
  const tabPresent = tabItems.filter((i) => i.presence === "PRESENT").length;
  const unsetIds = visible.filter((i) => i.presence === "UNSET").map((i) => i.id);
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  useEffect(() => {
    setOpenGroups([]);
  }, [tab, activeCategory]);

  function toggleGroup(name: string) {
    setOpenGroups((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]
    );
  }

  const tabButtons = COVERAGE_TABS.map((t) => {
    const catItems = items.filter((i) => t.categories.includes(i.category));
    const done = catItems.filter((i) => i.presence !== "UNSET").length;
    const hits = catItems.filter((i) => i.presence === "PRESENT").length;
    const skipped = isTabSkipped(t.id, skippedCoverages);
    const active = tab === t.id;
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => {
          onTab(t.id);
          if (t.systems?.[0]) setSystem(t.systems[0]);
        }}
        className={cn(
          "relative shrink-0 rounded-md border px-3 text-left touch-manipulation",
          "h-12 snap-start lg:h-auto lg:w-full lg:px-3 lg:py-2.5",
          active
            ? skipped
              ? "border-white/20 bg-brand-navy-deep/60 text-brand-slate"
              : "border-brand-gold bg-brand-gold text-brand-navy"
            : skipped
              ? "border-white/10 text-white/30"
              : "border-white/10 text-brand-slate hover:border-brand-gold/30"
        )}
      >
        <span className="block font-serif text-[11px] font-semibold tracking-[0.12em] lg:text-sm">
          {t.short}
          <span className="hidden lg:inline"> · {t.label}</span>
        </span>
        <span
          className={cn(
            "block font-mono text-[8px] font-bold uppercase tracking-[0.14em] lg:mt-0.5 lg:text-[9px]",
            active && !skipped ? "text-brand-navy/70" : "text-white/35"
          )}
        >
          {skipped ? "—" : `${done}/${catItems.length}${hits ? ` · ${hits}` : ""}`}
        </span>
      </button>
    );
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-white/10 p-3 lg:flex">
        <p className="eyebrow mb-2 px-1">Coverage</p>
        {tabButtons}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="no-scrollbar flex gap-1 overflow-x-auto snap-x snap-mandatory border-b border-white/10 px-2 py-2 lg:hidden">
          {tabButtons}
        </div>

        <div
          className={cn(
            "border-b px-4 py-4 sm:px-5",
            coverageOff
              ? "border-white/10 bg-brand-navy-deep/40"
              : "border-brand-gold/20 bg-brand-gold/5"
          )}
        >
          <p className={cn("eyebrow", coverageOff ? "text-brand-slate" : "text-brand-gold")}>
            {spec.coverage}
          </p>
          <h2 className="mt-1 font-serif text-xl tracking-wide text-brand-white sm:text-2xl">
            {spec.label}
          </h2>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-brand-slate sm:text-sm">
            {spec.brief}
          </p>
          {tabPresent ? (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-brand-gold/80">
              {tabPresent} finding{tabPresent === 1 ? "" : "s"} kept · {peril} protocol
            </p>
          ) : (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-brand-slate">
              {peril} protocol
            </p>
          )}
          <button
            type="button"
            onClick={() => onSkipCoverage(tab, !coverageOff)}
            className={cn(
              "mt-4 h-11 w-full rounded-md border font-mono text-[10px] font-bold uppercase tracking-[0.16em] touch-manipulation sm:max-w-md",
              coverageOff
                ? "border-brand-amber/40 bg-brand-amber/10 text-brand-amber"
                : "border-brand-white/15 text-brand-slate"
            )}
          >
            {coverageOff ? "This coverage applies" : "Does not apply"}
          </button>
        </div>

        {coverageOff ? (
          <div className="flex flex-1 flex-col justify-center px-6 py-16 pb-28 sm:px-10">
            <p className="font-serif text-lg tracking-wide text-brand-white sm:text-xl">
              {spec.label} is not on this walk
            </p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-brand-slate">
              Left off until you mark it. Nothing here needs a finding.
            </p>
          </div>
        ) : (
          <>
            {spec.systems ? (
              <div className="no-scrollbar flex gap-1 overflow-x-auto snap-x snap-mandatory border-b border-white/10 px-2 py-2 md:flex-wrap md:overflow-visible">
                {spec.systems.map((c) => {
                  const catItems = items.filter((i) => i.category === c);
                  const done = catItems.filter((i) => i.presence !== "UNSET").length;
                  const skipped = isSystemSkipped(c, skippedSystems);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSystem(c)}
                      className={cn(
                        "h-10 shrink-0 snap-start rounded-md border px-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] touch-manipulation",
                        activeCategory === c
                          ? skipped
                            ? "border-white/20 bg-brand-navy-deep/60 text-brand-slate"
                            : "border-brand-gold/60 bg-brand-gold/10 text-brand-gold"
                          : skipped
                            ? "border-white/10 text-white/30"
                            : "border-white/10 text-brand-slate"
                      )}
                    >
                      {CATEGORY_META[c].label}
                      <span className="ml-2 text-white/35">
                        {skipped ? "—" : `${done}/${catItems.length}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {systemOff && activeCategory ? (
              <div className="flex flex-1 flex-col px-4 py-8 pb-28 sm:px-6">
                <p className="font-serif text-lg tracking-wide text-brand-white">
                  {CATEGORY_META[activeCategory].label} is not on this walk
                </p>
                <p className="mt-2 max-w-md text-sm text-brand-slate">
                  This system stays off until you mark it.
                </p>
                <button
                  type="button"
                  onClick={() => onSkipSystem(activeCategory, false)}
                  className="mt-5 h-11 w-full max-w-md rounded-md border border-brand-amber/40 bg-brand-amber/10 font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-amber touch-manipulation"
                >
                  This system applies
                </button>
              </div>
            ) : (
              <>
                {spec.systems && activeCategory ? (
                  <div className="px-4 pt-3 sm:px-5">
                    <button
                      type="button"
                      onClick={() => onSkipSystem(activeCategory, true)}
                      className="h-10 w-full max-w-md rounded-md border border-white/10 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-slate touch-manipulation"
                    >
                      Does not apply
                    </button>
                  </div>
                ) : null}

                <ul className="flex-1 overflow-y-auto pb-36 xl:grid xl:grid-cols-2 xl:content-start xl:gap-px xl:pb-8">
                  {grouped.map(([group, rows]) => {
                    const open = openGroups.includes(group);
                    const done = rows.filter((i) => i.presence !== "UNSET").length;
                    const hits = rows.filter((i) => i.presence === "PRESENT").length;
                    return (
                      <li key={group} className="border-b border-white/10 xl:border-white/5">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group)}
                          aria-expanded={open}
                          className="sticky top-0 z-10 flex w-full items-center gap-3 border-b border-white/5 bg-brand-navy/95 px-4 py-3 text-left backdrop-blur-sm touch-manipulation sm:px-5"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block font-serif text-[13px] tracking-[0.14em] text-brand-gold">
                              {group}
                            </span>
                            <span className="mt-0.5 block font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-slate">
                              {done}/{rows.length}
                              {hits ? ` · ${hits} finding${hits === 1 ? "" : "s"}` : ""}
                            </span>
                          </span>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 text-brand-gold/80 transition-transform",
                              open ? "rotate-180" : "rotate-0"
                            )}
                          />
                        </button>
                        {open ? (
                          <ul>
                            {rows.map((item) => {
                              const def = INDICATOR_BY_TYPE[item.indicatorType];
                              const photoCount = photos.filter(
                                (p) => p.inspectionItemId === item.id
                              ).length;
                              return (
                                <ChecklistRow
                                  key={item.id}
                                  item={item}
                                  photoCount={photoCount}
                                  onPresence={onPresence}
                                  onOpen={onOpen}
                                  prompt={def?.prompt}
                                  why={def?.why}
                                  denial={def?.denial}
                                  label={def?.label ?? item.indicatorType}
                                />
                              );
                            })}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                {!listOff && unsetIds.length ? (
                  <div className="pointer-events-none sticky bottom-14 z-20 px-4 pb-2 lg:bottom-2">
                    <button
                      type="button"
                      onClick={() => onMarkRestNotPresent(unsetIds)}
                      className="pointer-events-auto w-full rounded-md border border-white/15 bg-brand-navy/95 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-brand-slate backdrop-blur-sm touch-manipulation sm:max-w-md"
                    >
                      Remainder of this list — not observed
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ChecklistRow({
  item,
  photoCount,
  onPresence,
  onOpen,
  label,
  prompt,
  why,
  denial,
}: {
  item: LocalItem;
  photoCount: number;
  onPresence: (item: LocalItem, presence: Presence) => void;
  onOpen: (item: LocalItem) => void;
  label: string;
  prompt?: string;
  why?: string;
  denial?: string;
}) {
  const finding = item.presence === "PRESENT";
  const ruled = item.presence === "NOT_PRESENT";

  return (
    <div
      className={cn(
        "border-b border-white/10 px-4 py-4 sm:px-5",
        finding && "bg-brand-gold/5",
        ruled && "opacity-70"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 h-10 w-0.5 shrink-0 ",
            finding
              ? "bg-brand-gold"
              : ruled
                ? "bg-severity-minor"
                : "bg-white/15"
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="font-serif text-[15px] leading-snug tracking-wide text-brand-white">
              {label}
            </p>
            {item.severity ? (
              <span
                className={cn(
                  "shrink-0 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em]",
                  SEVERITY_META[item.severity as Severity].className
                )}
              >
                {SEVERITY_META[item.severity as Severity].label}
              </span>
            ) : null}
          </div>
          {prompt ? (
            <p className="mt-1 text-xs leading-relaxed text-brand-slate">{prompt}</p>
          ) : null}
          {item.aiSuggestedIndicator && !item.adjusterConfirmed ? (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-brand-gold">
              AI draft — confirm before report
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onPresence(item, "PRESENT")}
          className={cn(
            "h-11 rounded-md border font-mono text-[10px] font-bold uppercase tracking-[0.16em] touch-manipulation",
            finding
              ? "border-brand-gold bg-brand-gold text-brand-navy"
              : "border-white/15 text-brand-slate"
          )}
        >
          Finding
        </button>
        <button
          type="button"
          onClick={() => onPresence(item, "NOT_PRESENT")}
          className={cn(
            "h-11 rounded-md border font-mono text-[10px] font-bold uppercase tracking-[0.16em] touch-manipulation",
            ruled
              ? "border-severity-minor/50 bg-severity-minor/15 text-severity-minor"
              : "border-white/15 text-brand-slate"
          )}
        >
          Not observed
        </button>
      </div>

      {finding ? (
        <div className="mt-3 space-y-2">
          {why ? (
            <p className="text-[11px] leading-relaxed text-brand-white/75">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-gold">
                Why it matters
              </span>
              <span className="mt-0.5 block">{why}</span>
            </p>
          ) : null}
          {denial ? (
            <p className="rounded-md border border-denied/30 bg-denied-muted px-3 py-2 text-[11px] leading-relaxed text-denied-soft">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em]">
                Carrier will argue
              </span>
              <span className="mt-0.5 block">{denial}</span>
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="min-h-11 font-mono text-[10px] uppercase tracking-[0.16em] text-brand-gold"
          >
            Severity, notes, photos
            {photoCount ? ` · ${photoCount}` : ""}
          </button>
        </div>
      ) : null}
    </div>
  );
}
