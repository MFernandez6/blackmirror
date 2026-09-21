import type { AiDraft } from "@/lib/offline/types";

/** Combined block for notes, vault rationale, and generated narratives. */
export function formatDefenseDraft(analysis: AiDraft): string {
  const parts: string[] = [];
  if (analysis.visualRationale?.trim()) {
    parts.push(analysis.visualRationale.trim());
  }
  if (analysis.likelyDenial?.trim()) {
    parts.push(`Carrier will likely argue: ${analysis.likelyDenial.trim()}`);
  }
  if (analysis.affirmativeDefense?.trim()) {
    parts.push(`Affirmative defense: ${analysis.affirmativeDefense.trim()}`);
  }
  if (analysis.denialRebuttal?.trim()) {
    parts.push(`Rebuttal for the file: ${analysis.denialRebuttal.trim()}`);
  }
  return parts.join("\n\n");
}
