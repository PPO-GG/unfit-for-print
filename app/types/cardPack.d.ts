/** One row of per-pack metadata, as returned by /api/admin/cards/pack-meta. */
export interface CardPackMeta {
  pack: string;
  displayName: string | null;
  description: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  official: boolean;
  nsfw: boolean;
}
