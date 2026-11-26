import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-haiku-4-5";
const RETIRED = new Set([
  "claude-sonnet-4-20250514",
  "claude-sonnet-4-0",
  "claude-opus-4-20250514",
]);

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

const SEE = `You identify one household contents item for a Florida public adjuster.
The adjuster already named it. Use that name. Do not decide coverage, causation, or a price.
Reply with ONLY JSON:
{
  "itemName": string,
  "brand": string | null,
  "modelNumber": string | null,
  "description": string,
  "condition": "NEW" | "GOOD" | "FAIR" | "POOR" | "DESTROYED",
  "quantity": number
}
Rules:
- itemName is the adjuster's item type unless the photo clearly shows a different object.
- brand and modelNumber come from the photo or the adjuster's notes. Use null when neither shows them.
- description is what is visible: type, color, material, and obvious damage. Two sentences at most.
- quantity is how many are clearly visible. Use 1 when the count is unclear.`;

function findPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return `You find one current United States retail listing for a household item.
The current date is ${today}. Prices change, so use one web search before you answer.
Search the brand and model first. If the age suggests that model is discontinued, search the current equivalent of that brand and type. Do not run a second search.
The search query may name the product, brand, and model only. Never include a person's name, a street address, a claim number, a policy number, or a room.
Reply with ONLY JSON:
{
  "itemName": string,
  "brand": string | null,
  "modelNumber": string | null,
  "matchKind": "SAME" | "SIMILAR" | "UNIDENTIFIED",
  "productTitle": string | null,
  "productUrl": string | null,
  "listedPrice": number | null,
  "priceNote": string
}
Rules:
- SAME only when the listing is the same brand and model. SIMILAR when it is the same kind of product. UNIDENTIFIED when you did not open a page.
- listedPrice is a USD price printed on a page you opened. If no price was printed, listedPrice is null. Never invent a price.
- productUrl is an https page from the search. If you did not open a page, productUrl is null.
- priceNote says whether the figure is a listed price for the same item, a listed price for a similar item, or that no current price was found.`;
}

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
  const raw = (process.env.ANTHROPIC_CONTENTS_MODEL || "").trim();
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
  const lines = [`Item: ${hints.itemType}`];
  if (hints.brand) lines.push(`Brand: ${hints.brand}`);
  if (hints.modelNumber) lines.push(`Model: ${hints.modelNumber}`);
  if (hints.age) lines.push(`Approximate age: ${hints.age}`);
  return `${lines.join("\n")}\nFind one current replacement listing for this item. JSON only.`;
}

function blankItem(hints: ContentsHints): ContentsIdentification {
  return {
    itemName: hints.itemType,
    brand: hints.brand,
    modelNumber: hints.modelNumber,
    description: "",
    condition: "GOOD",
    quantity: 1,
    matchKind: "UNIDENTIFIED",
    productTitle: null,
    productUrl: null,
    listedPrice: null,
    priceNote: "No current price was found.",
  };
}

function mediaType(mime: string): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  if (mime.includes("png")) return "image/png";
  if (mime.includes("webp")) return "image/webp";
  if (mime.includes("gif")) return "image/gif";
  return "image/jpeg";
}

const SEARCH_TOOL: Anthropic.ToolUnion = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 1,
  allowed_callers: ["direct"],
  user_location: {
    type: "approximate",
    country: "US",
    region: "Florida",
    timezone: "America/New_York",
  },
};

function explainContentsError(err: unknown): Error | null {
  const message = err instanceof Error ? err.message : String(err);
  if (/invalid x-api-key|authentication_error|\b401\b/.test(message)) {
    return new Error("Contents pricing rejected the API key.");
  }
  if (/credit balance|purchase credits|plans & billing/i.test(message)) {
    return new Error("Contents pricing has no remaining API credits.");
  }
  return null;
}

function readJson(message: Anthropic.Message): ContentsIdentification | null {
  try {
    return coerceContentsIdentification(parseJson(messageText(message)));
  } catch {
    return null;
  }
}

function listingFromSearch(message: Anthropic.Message): { title: string; url: string } | null {
  for (const block of message.content) {
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const hit of block.content) {
      if (hit.type !== "web_search_result" || !hit.url.startsWith("https://")) continue;
      return { title: hit.title.slice(0, 200) || "Current listing", url: hit.url.slice(0, 500) };
    }
  }
  return null;
}

async function complete(opts: {
  client: Anthropic;
  model: string;
  system: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.ToolUnion[];
  maxTokens: number;
}) {
  let message: Anthropic.Message | null = null;
  for (let turn = 0; turn < 4; turn++) {
    message = await opts.client.messages.create(
      {
        model: opts.model,
        max_tokens: opts.maxTokens,
        system: opts.system,
        ...(opts.tools?.length ? { tools: opts.tools } : {}),
        messages: opts.messages,
      },
      { timeout: 25_000 }
    );
    if (message.stop_reason !== "pause_turn") break;
    opts.messages.push({ role: "assistant", content: message.content });
  }
  if (!message) throw new Error("Contents pricing returned no response.");
  return message;
}

function applyListing(
  seen: ContentsIdentification,
  priced: ContentsIdentification | null,
  hit: { title: string; url: string } | null
): ContentsIdentification {
  const productUrl = priced?.productUrl || hit?.url || null;
  const productTitle = priced?.productTitle || hit?.title || null;
  const listedPrice = productUrl ? priced?.listedPrice ?? null : null;
  let matchKind = priced?.matchKind ?? seen.matchKind;
  if (!productUrl) matchKind = "UNIDENTIFIED";
  else if (matchKind === "UNIDENTIFIED") matchKind = "SIMILAR";
  return {
    ...seen,
    brand: priced?.brand || seen.brand,
    modelNumber: priced?.modelNumber || seen.modelNumber,
    matchKind,
    productTitle,
    productUrl,
    listedPrice,
    priceNote:
      priced?.priceNote ||
      (productUrl
        ? "A current listing was found. Confirm the price before using it."
        : "No current price was found."),
  };
}

export function contentsAiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export async function identifyContentsItem(opts: {
  bytes: Buffer;
  mimeType: string;
  hints: ContentsHints;
}): Promise<ContentsIdentification> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("Contents pricing rejected the API key.");
  const client = new Anthropic({ apiKey: key });
  const model = modelName();
  let seen = blankItem(opts.hints);
  try {
    const looked = await complete({
      client,
      model,
      system: SEE,
      maxTokens: 800,
      messages: [
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
              text: `Room or area: ${opts.hints.room}\nItem: ${opts.hints.itemType}${opts.hints.brand ? `\nBrand: ${opts.hints.brand}` : ""}${opts.hints.modelNumber ? `\nModel: ${opts.hints.modelNumber}` : ""}${opts.hints.age ? `\nApproximate age: ${opts.hints.age}` : ""}\nDescribe the item. JSON only.`,
            },
          ],
        },
      ],
    });
    const parsed = readJson(looked);
    if (parsed) {
      seen = {
        ...parsed,
        itemName: parsed.itemName || opts.hints.itemType,
        brand: parsed.brand || opts.hints.brand,
        modelNumber: parsed.modelNumber || opts.hints.modelNumber,
        productTitle: null,
        productUrl: null,
        listedPrice: null,
        matchKind: "UNIDENTIFIED",
        priceNote: "No current price was found.",
      };
    }
  } catch (err) {
    const explained = explainContentsError(err);
    if (explained) throw explained;
  }

  try {
    const found = await complete({
      client,
      model,
      system: findPrompt(),
      tools: [SEARCH_TOOL],
      maxTokens: 4096,
      messages: [{ role: "user", content: contentsHintText(opts.hints) }],
    });
    return applyListing(seen, readJson(found), listingFromSearch(found));
  } catch (err) {
    const explained = explainContentsError(err);
    if (explained) throw explained;
    return {
      ...seen,
      priceNote: "No current listing was found. Enter the unit cost.",
    };
  }
}
