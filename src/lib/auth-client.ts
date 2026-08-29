import type { AdjusterRole } from "@prisma/client";

export function canEdit(role: AdjusterRole): boolean {
  return role === "ADMIN" || role === "ADJUSTER";
}
