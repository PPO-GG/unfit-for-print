/** One pack row, as returned by /api/admin/cards/pack-meta. */
export interface CardPackMeta {
  id: string;
  /** The pack's name (under its pre-id key). */
  pack: string;
  /** Retired with pack ids; never sent. Kept optional for packLabel's meta type. */
  displayName?: string | null;
  description: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  official: boolean;
  nsfw: boolean;
  isDefault: boolean;
  /** The brand/series this pack belongs to, e.g. "Cards Against Humanity". */
  series: string | null;
}
