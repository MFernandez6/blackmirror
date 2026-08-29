import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalize BL-YY-#### / BB-YYYY-#### / loose digits into BLACKLINE BL-YY-#### */
export function normalizeClaimNumber(raw: string): string {
  const compact = raw.trim().toUpperCase().replace(/\s+/g, "");
  const bl = compact.match(/^BL-?(\d{2})-?(\d{1,4})$/);
  if (bl) {
    return `BL-${bl[1]}-${bl[2].padStart(4, "0")}`;
  }
  const bb = compact.match(/^BB-?(\d{2}|\d{4})-?(\d{1,4})$/);
  if (bb) {
    const yy = bb[1].length === 4 ? bb[1].slice(-2) : bb[1];
    return `BL-${yy}-${bb[2].padStart(4, "0")}`;
  }
  const digits = compact.match(/^(\d{2})(\d{4})$/);
  if (digits) {
    return `BL-${digits[1]}-${digits[2]}`;
  }
  return compact;
}
