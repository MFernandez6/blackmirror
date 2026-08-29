/**
 * Florida ZIP → county suggest (prefix / exact map for common ranges).
 * Not exhaustive — intake still allows manual county entry.
 */

const EXACT: Record<string, string> = {
  "33145": "Miami-Dade",
  "33101": "Miami-Dade",
  "33109": "Miami-Dade",
  "33125": "Miami-Dade",
  "33130": "Miami-Dade",
  "33139": "Miami-Dade",
  "33316": "Broward",
  "33301": "Broward",
  "33304": "Broward",
  "33311": "Broward",
  "33401": "Palm Beach",
  "33480": "Palm Beach",
  "33615": "Hillsborough",
  "33602": "Hillsborough",
  "33606": "Hillsborough",
  "32801": "Orange",
  "32803": "Orange",
  "32819": "Orange",
  "34102": "Collier",
  "34103": "Collier",
  "32118": "Volusia",
  "32114": "Volusia",
  "32202": "Duval",
  "32301": "Leon",
  "32501": "Escambia",
  "33901": "Lee",
  "34236": "Sarasota",
  "33701": "Pinellas",
};

const PREFIX3: Record<string, string> = {
  "330": "Miami-Dade",
  "331": "Miami-Dade",
  "332": "Miami-Dade",
  "333": "Broward",
  "334": "Palm Beach",
  "335": "Hillsborough",
  "336": "Hillsborough",
  "337": "Pinellas",
  "338": "Polk",
  "339": "Lee",
  "341": "Collier",
  "342": "Sarasota",
  "346": "Pasco",
  "347": "Osceola",
  "349": "St. Lucie",
  "320": "Duval",
  "322": "Duval",
  "321": "Volusia",
  "327": "Seminole",
  "328": "Orange",
  "329": "Brevard",
  "323": "Leon",
  "324": "Bay",
  "325": "Escambia",
};

export function suggestCountyFromZip(zip: string): string | null {
  const cleaned = zip.replace(/\D/g, "").slice(0, 5);
  if (cleaned.length < 3) return null;
  if (cleaned.length === 5 && EXACT[cleaned]) return EXACT[cleaned];
  const prefix = cleaned.slice(0, 3);
  return PREFIX3[prefix] ?? null;
}
