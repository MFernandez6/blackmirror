import Anthropic from "@anthropic-ai/sdk";
import {
  CATEGORIES,
  INDICATOR_BY_TYPE,
  INDICATOR_TYPES,
  type Confidence,
  type InspectionCategory,
  type Severity,
} from "@/lib/inspection/indicators";

const DEFAULT_MODEL = "claude-sonnet-4-6";

export type PhotoAnalysis = {
  category: InspectionCategory;
  indicatorType: string;
  confidence: Confidence;
  estimatedSeverity: Severity;
  visualRationale: string;
};

const CLOSED_SET = INDICATOR_TYPES.map(
  (t) => `${t} (${INDICATOR_BY_TYPE[t].label})`
).join("\n");

const SYSTEM = `You are a licensed public adjuster's field assistant for BLACKMIRROR.
You classify property-damage photographs. You do not determine coverage or causation as a final finding.
Return ONLY JSON — no markdown — with this exact shape:
{
  "category": one of ${JSON.stringify(CATEGORIES)},
  "indicatorType": string (MUST be one of the closed indicatorType keys listed),
  "confidence": "CONFIRMED" | "SUSPECTED",
  "estimatedSeverity": "MINOR" | "MODERATE" | "SEVERE" | "CRITICAL",
  "visualRationale": string
}

visualRationale must describe observable features (crack orientation, staining halo wet vs dry, granule density, crease vs scuff, fogging between panes, etc.). Do not assert coverage, liability, or date of loss.

Closed indicatorType keys:
${CLOSED_SET}

If the photo is not damage, pick the closest indicator and set confidence to SUSPECTED with a rationale that says the photo is inconclusive.`;

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
  };
}

export async function analyzeInspectionPhoto(opts: {
  bytes: Buffer;
  mimeType: string;
}): Promise<PhotoAnalysis> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
  }
  const model =
    process.env.ANTHROPIC_POLICY_MODEL?.trim() || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey: key });
  const media =
    opts.mimeType.includes("png")
      ? "image/png"
      : opts.mimeType.includes("webp")
        ? "image/webp"
        : "image/jpeg";

  const message = await client.messages.create({
    model,
    max_tokens: 800,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: media as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: opts.bytes.toString("base64"),
            },
          },
          {
            type: "text",
            text: "Classify this field photograph against the closed indicator library. JSON only.",
          },
        ],
      },
    ],
  });

  const text = message.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");
  const parsed = coerce(parseJson(text));
  if (!parsed) {
    throw new Error("Model returned an unconstrained or unreadable classification.");
  }
  return parsed;
}
