import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-haiku-4-5";
const RETIRED = new Set([
  "claude-sonnet-4-20250514",
  "claude-sonnet-4-0",
  "claude-opus-4-20250514",
]);
const MAX_SEARCHES = 1;

export type ContentsMatchKind = "SAME" | "SIMILAR" | "UNIDENTIFIED";

export type ContentsIdentification = {
  itemName: string;
  brand: string | null;
  modelNumber: string | null;
  description: string;
  condition: string;
  quantity: number;
  matchKind: ContentsMatchKind;
  productTitle: string | null;
  productUrl: string | null;
  listedPrice: number | null;
  priceNote: string;
};

const SYSTEM = `You itemize Coverage C personal property for a Florida public adjuster.
A licensed adjuster confirms every line. You do not decide coverage, causation, or the amount the carrier owes.

The adjuster already named the item. Treat those notes as the search target. Use one web search for the same product, or the closest similar replacement still sold in the United States. Prefer the manufacturer's page, a major retailer, or a current listing that shows a price. If a brand or model is given, search that first. If the age suggests the model is discontinued, search the current equivalent of that brand and type. Do not run a second search.

Search queries may name the product, brand, and model only. Never include a person's name, a street address, a claim number, or a policy number. The room is context only and must not appear in the search.

Reply with ONLY JSON:
{
  "itemName": string,
  "brand": string | null,
  "modelNumber": string | null,
  "description": string,
  "condition": "NEW" | "GOOD" | "FAIR" | "POOR" | "DESTROYED",
  "quantity": number,
  "matchKind": "SAME" | "SIMILAR" | "UNIDENTIFIED",
  "productTitle": string | null,
  "productUrl": string | null,
  "listedPrice": number | null,
  "priceNote": string
}

Rules:
- SAME only when the listing is the same brand and model visible in the photo. SIMILAR when it is the same kind of product but not that exact model. UNIDENTIFIED when the photo does not show what the object is.
- listedPrice is the current USD price printed on a page you opened. If no price was printed, listedPrice is null. Never invent a price.
- productUrl is a page from your search. If you did not open a page, productUrl is null.
- quantity is how many of that item are clearly visible. Use 1 when the count is unclear.
- description is what is visible: type, color, material, and obvious damage. Two sentences at most.
- priceNote says whether the figure is a listed price for the same item, a listed price for a similar item, or that no current price was found.`;

function clip(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    return url.toString().slice(0, 500);
  } catch {
    return null;
  }
}

export function coerceContentsIdentification(raw: unknown): ContentsIdentification | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const itemName = clip(o.itemName, 160);
  if (!itemName) return null;
  const kind = o.matchKind === "SAME" || o.matchKind === "SIMILAR" ? o.matchKind : "UNIDENTIFIED";
  const condition = ["NEW", "GOOD", "FAIR", "POOR", "DESTROYED"].includes(String(o.condition))
    ? String(o.condition)
    : "GOOD";
  const qty = Number(o.quantity);
  const quantity = Number.isFinite(qty) ? Math.min(999, Math.max(1, Math.round(qty))) : 1;
  const price = typeof o.listedPrice === "number" ? o.listedPrice : Number(o.listedPrice);
  const listedPrice =
    Number.isFinite(price) && price >= 0 && price <= 1_000_000 ? Math.round(price * 100) / 100 : null;
  return {
    itemName,
    brand: clip(o.brand, 80),
    modelNumber: clip(o.modelNumber, 80),
    description: clip(o.description, 600) ?? "",
    condition,
    quantity,
    matchKind: kind,
    productTitle: clip(o.productTitle, 200),
    productUrl: httpsUrl(o.productUrl),
    listedPrice,
    priceNote: clip(o.priceNote, 300) ?? "No current price was found.",
  };
}

function modelName() {
  const raw = (process.env.ANTHROPIC_CONTENTS_MODEL || process.env.ANTHROPIC_PHOTO_MODEL || "").trim();
  if (!raw || RETIRED.has(raw) || raw === "[SENSITIVE]") return DEFAULT_MODEL;
  return raw;
}

function messageText(message: Anthropic.Message) {
  return message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
}

export type ContentsHints = {
  room: string;
  itemType: string;
  brand: string | null;
  modelNumber: string | null;
  age: string | null;
};

export function contentsHintText(hints: ContentsHints) {
  const lines = [`Room or area: ${hints.room}`, `Item: ${hints.itemType}`];
  if (hints.brand) lines.push(`Brand: ${hints.brand}`);
  if (hints.modelNumber) lines.push(`Model: ${hints.modelNumber}`);
  if (hints.age) lines.push(`Approximate age: ${hints.age}`);
  return `${lines.join("\n")}\nFind one current replacement listing for this item. JSON only.`;
}

function mediaType(mime: string): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  if (mime.includes("png")) return "image/png";
  if (mime.includes("webp")) return "image/webp";
  if (mime.includes("gif")) return "image/gif";
  return "image/jpeg";
}

async function ask(opts: {
  bytes: Buffer;
  mimeType: string;
  hints: ContentsHints;
  search: boolean;
}): Promise<ContentsIdentification> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured.");
  const client = new Anthropic({ apiKey: key });
  const model = modelName();
  const tools: Anthropic.ToolUnion[] = opts.search
    ? [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: MAX_SEARCHES,
          user_location: {
            type: "approximate",
            country: "US",
            region: "Florida",
            timezone: "America/New_York",
          },
        },
      ]
    : [];
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType(opts.mimeType),
            data: opts.bytes.toString("base64"),
          },
        },
        {
          type: "text",
          text: contentsHintText(opts.hints),
        },
      ],
    },
  ];
  let message: Anthropic.Message | null = null;
  for (let turn = 0; turn < 2; turn++) {
    message = await client.messages.create({
      model,
      max_tokens: 700,
      system: SYSTEM,
      ...(tools.length ? { tools } : {}),
      messages,
    });
    if (message.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: message.content });
  }
  if (!message) throw new Error("Contents pricing returned no response.");
  const parsed = coerceContentsIdentification(parseJson(messageText(message)));
  if (!parsed) throw new Error("Contents pricing returned an unreadable item.");
  return parsed;
}

export function contentsAiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export async function identifyContentsItem(opts: {
  bytes: Buffer;
  mimeType: string;
  hints: ContentsHints;
}): Promise<ContentsIdentification> {
  try {
    return await ask({ ...opts, search: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (/web_search|tool/i.test(detail)) return ask({ ...opts, search: false });
    throw new Error(`Contents pricing failed: ${detail}`);
  }
}
