import type { AdminPack } from "~/types/adminCard";
import { isPackDisabled, packTotal } from "~/utils/packListView";

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
  // An empty pack has no cards to disable, so it reads as enabled: otherwise
  // its Enabled switch would start off and flipping it would change nothing.
  active: packTotal(p) === 0 || !isPackDisabled(p),
});

/**
 * `sortOrder` compares as a number: `v-model.number` yields "" for a cleared
 * field and a string for input it cannot parse, and `savePack` sends
 * `Number(d.sortOrder) || 0` anyway — a strict compare would keep the form
 * dirty after a save that stored exactly what was typed.
 */
const fieldEqual = (a: PackDraft, b: PackDraft, k: keyof PackDraft) =>
  k === "sortOrder" ? (Number(a[k]) || 0) === (Number(b[k]) || 0) : a[k] === b[k];

export const draftsEqual = (a: PackDraft, b: PackDraft) =>
  (Object.keys(a) as (keyof PackDraft)[]).every((k) => fieldEqual(a, b, k));

/**
 * Carry a dirty draft onto a reload of the same pack: every field the admin
 * left as seeded takes the incoming value, every edited field keeps the edit.
 * Keeping the whole stale draft would let Save undo a change made elsewhere
 * mid-edit (e.g. "Set as default" from the selection bar).
 */
export function rebaseDraft(draft: PackDraft, base: PackDraft, incoming: PackDraft): PackDraft {
  const next = { ...draft } as Record<keyof PackDraft, unknown>;
  for (const k of Object.keys(incoming) as (keyof PackDraft)[]) {
    if (fieldEqual(draft, base, k)) next[k] = incoming[k];
  }
  return next as unknown as PackDraft;
}
