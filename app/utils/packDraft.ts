import type { AdminPack } from "~/types/adminCard";
import { isPackDisabled } from "~/utils/packListView";

/** The editable state of one pack, as the inspector form holds it. */
export interface PackDraft {
  name: string;
  series: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  official: boolean;
  nsfw: boolean;
  isDefault: boolean;
  active: boolean;
}

export const packToDraft = (p: AdminPack): PackDraft => ({
  name: p.name,
  series: p.series ?? "",
  description: p.description ?? "",
  icon: p.icon ?? "",
  color: p.color ?? "",
  sortOrder: p.sortOrder,
  official: p.official,
  nsfw: p.nsfw,
  isDefault: p.isDefault,
  active: !isPackDisabled(p),
});

export const draftsEqual = (a: PackDraft, b: PackDraft) =>
  (Object.keys(a) as (keyof PackDraft)[]).every((k) => a[k] === b[k]);
