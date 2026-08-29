/** Deterministic 384-d hashed embedding so cosine search works without a second vendor. */

export const EMBEDDING_DIM = 384;

function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h;
}

export function embedText(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIM).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9%.]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (!tokens.length) return vec;
  for (const token of tokens) {
    const h = hashToken(token);
    const idx = Math.abs(h) % EMBEDDING_DIM;
    vec[idx] += h < 0 ? -1 : 1;
    const idx2 = Math.abs(hashToken(`${token}#2`)) % EMBEDDING_DIM;
    vec[idx2] += 0.5;
  }
  let mag = 0;
  for (const n of vec) mag += n * n;
  mag = Math.sqrt(mag) || 1;
  return vec.map((n) => n / mag);
}

export function vectorLiteral(vec: number[]): string {
  return `[${vec.map((n) => n.toFixed(6)).join(",")}]`;
}
