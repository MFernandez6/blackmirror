import {
  INDICATOR_BY_TYPE,
  SEVERITY_META,
  type Confidence,
  type Severity,
} from "./indicators";

export type NarrativeItem = {
  indicatorType: string;
  presence: "UNSET" | "PRESENT" | "NOT_PRESENT";
  severity: Severity | null;
  confidence: Confidence | null;
  notes: string | null;
  measurementValue: number | string | null;
  measurementUnit: string | null;
};

function fill(template: string, item: NarrativeItem): string {
  const def = INDICATOR_BY_TYPE[item.indicatorType];
  const severity = item.severity
    ? SEVERITY_META[item.severity].label.toLowerCase()
    : "undetermined";
  const confidence =
    item.confidence === "SUSPECTED"
      ? "suspected"
      : item.confidence === "CONFIRMED"
        ? "confirmed"
        : "observed";
  const measurement =
    item.measurementValue != null && item.measurementValue !== ""
      ? `${item.measurementValue}${item.measurementUnit ? ` ${item.measurementUnit}` : ""}`
      : "an unmeasured height/width";
  const notes = item.notes?.trim() ? ` Field note: ${item.notes.trim()}` : "";
  return template
    .replaceAll("{severity}", severity)
    .replaceAll("{confidence}", confidence)
    .replaceAll("{measurement}", measurement)
    .replaceAll("{notes}", notes);
}

export function generateNarrative(opts: {
  claimNumber: string;
  address: string;
  peril: string;
  inspectedAt: Date | string;
  adjusterName: string;
  items: NarrativeItem[];
}): string {
  const date = new Date(opts.inspectedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const present = opts.items.filter((i) => i.presence === "PRESENT");
  const absent = opts.items.filter((i) => i.presence === "NOT_PRESENT");

  const lines: string[] = [];
  lines.push(
    `FIELD INSPECTION NARRATIVE — Claim ${opts.claimNumber}`
  );
  lines.push(
    `Property: ${opts.address}. Date of inspection: ${date}. Inspected by ${opts.adjusterName}. Peril protocol: ${opts.peril}.`
  );
  lines.push("");
  lines.push("SCOPE / DAMAGE");
  if (present.length === 0) {
    lines.push(
      "No positive indicators were marked present at the time of this inspection. This draft should be reviewed before it is relied upon."
    );
  } else {
    for (const item of present) {
      const def = INDICATOR_BY_TYPE[item.indicatorType];
      if (!def) continue;
      lines.push(`• ${fill(def.narrative, item)}`);
    }
  }

  if (absent.length) {
    lines.push("");
    lines.push("INDICATORS NOT PRESENT");
    const labels = absent
      .map((i) => INDICATOR_BY_TYPE[i.indicatorType]?.label)
      .filter(Boolean);
    lines.push(
      `The following checklist items were marked not present: ${labels.join("; ")}.`
    );
  }

  lines.push("");
  lines.push(
    "This narrative is a field draft generated from checklist entries. The inspecting adjuster must review, correct, and adopt it before it is issued as a work product."
  );

  return lines.join("\n");
}
