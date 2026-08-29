export type InspectionReason =
  | "INITIAL_INSPECTION"
  | "REINSPECTION"
  | "ENGINEER_EXPERT_INSPECTION"
  | "SUPPLEMENTAL_INSPECTION"
  | "APPRAISAL_INSPECTION"
  | "MITIGATION_WALKTHROUGH"
  | "CUSTOM";

export const INSPECTION_REASONS: {
  value: InspectionReason;
  slug: string;
  label: string;
}[] = [
  { value: "INITIAL_INSPECTION", slug: "initial-inspection", label: "Initial inspection" },
  { value: "REINSPECTION", slug: "reinspection", label: "Reinspection" },
  {
    value: "ENGINEER_EXPERT_INSPECTION",
    slug: "engineer-expert-inspection",
    label: "Engineer & expert inspection",
  },
  {
    value: "SUPPLEMENTAL_INSPECTION",
    slug: "supplemental-inspection",
    label: "Supplemental inspection",
  },
  { value: "APPRAISAL_INSPECTION", slug: "appraisal-inspection", label: "Appraisal inspection" },
  { value: "MITIGATION_WALKTHROUGH", slug: "mitigation-walkthrough", label: "Mitigation walkthrough" },
  { value: "CUSTOM", slug: "custom", label: "Custom" },
];

export function reasonSlug(
  reason: InspectionReason,
  customText?: string | null
): string {
  if (reason === "CUSTOM" && customText) return slugify(customText);
  return INSPECTION_REASONS.find((r) => r.value === reason)?.slug ?? "inspection";
}

export const LOCATION_OPTIONS = [
  "Kitchen",
  "Primary Bedroom",
  "Bathroom",
  "Living Room",
  "Dining Room",
  "Family Room",
  "Hallway",
  "Laundry",
  "Attic",
  "Garage",
  "Closet",
  "Roof-Exterior",
  "Exterior-North",
  "Exterior-South",
  "Exterior-East",
  "Exterior-West",
  "Exterior-Front",
  "Exterior-Rear",
  "Patio",
  "Screen Enclosure",
  "Crawlspace",
  "Utility Room",
  "HOA Common Area",
] as const;

export function slugify(input: string, max = 60): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (slug || "untitled").slice(0, max);
}

export function vaultPhotoPath(opts: {
  claimNumber: string;
  date: string;
  reason: InspectionReason;
  customReason?: string | null;
  location: string;
  timeHms: string;
  description: string;
}): string {
  const date = opts.date.slice(0, 10);
  const reason = reasonSlug(opts.reason, opts.customReason);
  const loc = slugify(opts.location);
  const desc = slugify(opts.description || "field-photo");
  return `claims/${opts.claimNumber}/${date}_${reason}/${loc}/${opts.timeHms}_${desc}.jpg`;
}

export function displayVaultPath(storagePath: string): string {
  return storagePath.replace(/\.jpg$/i, "").replaceAll("/", " / ");
}
