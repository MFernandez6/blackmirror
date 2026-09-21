import Anthropic from "@anthropic-ai/sdk";
import {
  CATEGORIES,
  INDICATOR_BY_TYPE,
  INDICATOR_TYPES,
  type Severity,
} from "@/lib/inspection/indicators";
import type { AiDraft } from "@/lib/offline/types";
import { formatDefenseDraft } from "@/lib/ai/format-defense-draft";

export { formatDefenseDraft };

const DEFAULT_MODEL = "claude-sonnet-4-6";
const RETIRED_MODELS = new Set([
  "claude-sonnet-4-20250514",
  "claude-sonnet-4-0",
  "claude-opus-4-20250514",
]);

function resolveModel(): string {
  const raw = (process.env.ANTHROPIC_POLICY_MODEL || "").trim();
  if (!raw || RETIRED_MODELS.has(raw) || raw === "[SENSITIVE]") {
    return DEFAULT_MODEL;
  }
  return raw;
}

export type PhotoAnalysis = AiDraft;

const CLOSED_SET = INDICATOR_TYPES.map((t) => {
  const def = INDICATOR_BY_TYPE[t];
  return `${t} — ${def.label}. Typical carrier denial: ${def.denial}`;
}).join("\n");

const SYSTEM = `You are a Florida public-adjuster drafting assistant for BLACKMIRROR (Blackline Public Adjusters).
A licensed adjuster will review every word. You do not determine coverage, causation, or liability.

Return ONLY JSON — no markdown — with this exact shape:
{
  "category": one of ${JSON.stringify(CATEGORIES)},
  "indicatorType": string (MUST be one of the closed indicatorType keys listed),
  "confidence": "CONFIRMED" | "SUSPECTED",
  "estimatedSeverity": "MINOR" | "MODERATE" | "SEVERE" | "CRITICAL",
  "visualRationale": string,
  "likelyDenial": string,
  "affirmativeDefense": string,
  "denialRebuttal": string
}

Field rules:
- visualRationale: observable features only (crack orientation, wet vs dry halo, crease vs scuff, granule loss, fogging, tide line, etc.). No coverage conclusion.
- likelyDenial: the argument a carrier or IA is most likely to write from THIS photo (wear, long-term seepage, maintenance, pre-existing, earth movement, flood, construction defect, etc.). One or two sentences.
- affirmativeDefense: draft language the adjuster can drop into a scope, demand, or correspondence. Tie the visible damage to a sudden/accidental or storm-related presentation where the photo supports it. Use cautious phrasing ("consistent with", "supports", "if aligned with the reported date of loss"). Do not invent measurements, dates, or hidden conditions not visible.
- denialRebuttal: draft language answering likelyDenial with what the photo actually shows. This is the file's answer to the denial, not a courtroom brief.

Write affirmativeDefense and denialRebuttal as usable first-person-plural PA prose ("Inspection photographs show…", "The presentation is inconsistent with…"). 2–4 sentences each.

Closed indicatorType keys and typical carrier arguments:
${CLOSED_SET}

If the photo is inconclusive, still fill all four text fields, set confidence to SUSPECTED, and say what additional photo would close the gap.`;

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  return JSON.parse(raw);
}

function coerce(raw: unknown): PhotoAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const indicatorType = String(o.indicatorType ?? "");
  const def = INDICATOR_BY_TYPE[indicatorType];
  if (!def) return null;
  const confidence = o.confidence === "CONFIRMED" ? "CONFIRMED" : "SUSPECTED";
  const sev = String(o.estimatedSeverity ?? "MODERATE");
  const estimatedSeverity: Severity =
    sev === "MINOR" || sev === "SEVERE" || sev === "CRITICAL" || sev === "MODERATE"
      ? sev
      : "MODERATE";
  return {
    category: def.category,
    indicatorType: def.type,
    confidence,
    estimatedSeverity,
    visualRationale: String(o.visualRationale ?? "").slice(0, 2000),
    likelyDenial: String(o.likelyDenial ?? def.denial).slice(0, 2000),
    affirmativeDefense: String(o.affirmativeDefense ?? "").slice(0, 3000),
    denialRebuttal: String(o.denialRebuttal ?? "").slice(0, 3000),
  };
}

export async function analyzeInspectionPhoto(opts: {
  bytes: Buffer;
  mimeType: string;
  peril?: string | null;
}): Promise<PhotoAnalysis> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
  }
  const model = resolveModel();
  const client = new Anthropic({ apiKey: key });
  const media =
    opts.mimeType.includes("png")
      ? "image/png"
      : opts.mimeType.includes("webp")
        ? "image/webp"
        : "image/jpeg";

  const perilLine = opts.peril
    ? `This inspection is on a ${opts.peril} peril protocol.`
    : "Peril protocol was not provided.";

  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model,
      max_tokens: 2048,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: media as
                  | "image/jpeg"
                  | "image/png"
                  | "image/webp"
                  | "image/gif",
                data: opts.bytes.toString("base64"),
              },
            },
            {
              type: "text",
              text: `${perilLine} Classify this field photograph and draft affirmative-defense and denial-rebuttal language for the claim file. JSON only.`,
            },
          ],
        },
      ],
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Photo AI failed (model ${model}): ${detail}`);
  }

  const text = message.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");
  const parsed = coerce(parseJson(text));
  if (!parsed) {
    throw new Error("Model returned an unconstrained or unreadable classification.");
  }
  return parsed;
}
