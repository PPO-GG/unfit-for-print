/**
 * Rolls the per-type pack stats from `/api/cards/packs` up into the one-tile-
 * per-pack shape the Labs card browser renders.
 *
 * The route reports white and black packs separately (they are separate
 * tables), so a pack that has both shows up twice. Counts here are *active*
 * only, matching `/api/cards/browse` — a tile must never promise more cards
 * than the browser will actually list.
 */

export interface PackStat {
  pack: string;
  total: number;
  active: number;
}

export interface PackTile {
  pack: string;
  white: number;
  black: number;
  total: number;
  isDefault: boolean;
}

export type PackSort = "cards-desc" | "cards-asc" | "name";

/**
 * Orders gallery tiles for display. Kept separate from `buildPackGallery` so
 * that the rollup always returns one stable base order (A–Z) and the view can
 * re-sort it without refetching. Card-count ties fall back to the pack name,
 * so the gallery never reshuffles between renders.
 */
export function sortPackGallery(
  tiles: PackTile[],
  sort: PackSort,
): PackTile[] {
  const byName = (a: PackTile, b: PackTile) => a.pack.localeCompare(b.pack);

  return [...tiles].sort((a, b) => {
    if (sort === "name") return byName(a, b);
    const delta = sort === "cards-asc" ? a.total - b.total : b.total - a.total;
    return delta !== 0 ? delta : byName(a, b);
  });
}

/**
 * Locates a card within the paginated result set: which 1-based page holds the
 * card at `globalIndex`, and its offset inside that page. Lets the lightbox
 * address cards by their position in the whole pack rather than in the page
 * that happens to be loaded.
 */
export function pageForIndex(
  globalIndex: number,
  perPage: number,
): { page: number; offset: number } {
  if (perPage <= 0 || globalIndex < 0) return { page: 1, offset: 0 };
  return {
    page: Math.floor(globalIndex / perPage) + 1,
    offset: globalIndex % perPage,
  };
}

/**
 * Steps an index with wrap-around at both ends. Used for the lightbox's
 * position within the full result set, so stepping past the last card returns
 * to the first.
 */
export function stepCardIndex(
  current: number,
  delta: number,
  length: number,
): number {
  if (length <= 0) return 0;
  return (((current + delta) % length) + length) % length;
}

export interface PackGalleryView {
  search: string;
  defaultOnly: boolean;
  sort: PackSort;
}

/**
 * Applies the gallery's controls — pack-name search, default-rotation filter,
 * and sort — in that order. Kept out of the component so the ordering rules
 * are testable without mounting Nuxt UI.
 */
export function filterAndSortPacks(
  tiles: PackTile[],
  view: PackGalleryView,
): PackTile[] {
  const term = view.search.trim().toLowerCase();
  const filtered = tiles.filter(
    (tile) =>
      (!view.defaultOnly || tile.isDefault) &&
      (!term || tile.pack.toLowerCase().includes(term)),
  );
  return sortPackGallery(filtered, view.sort);
}

export function buildPackGallery(
  packs: { white: PackStat[]; black: PackStat[] },
  defaultPacks: string[],
): PackTile[] {
  const defaults = new Set(defaultPacks);
  const tiles = new Map<string, PackTile>();

  const add = (stats: PackStat[], key: "white" | "black") => {
    for (const stat of stats) {
      if (!stat.pack) continue;
      const tile =
        tiles.get(stat.pack) ??
        { pack: stat.pack, white: 0, black: 0, total: 0, isDefault: defaults.has(stat.pack) };
      tile[key] += stat.active;
      tile.total += stat.active;
      tiles.set(stat.pack, tile);
    }
  };

  add(packs.white ?? [], "white");
  add(packs.black ?? [], "black");

  return [...tiles.values()]
    .filter((tile) => tile.total > 0)
    .sort((a, b) => a.pack.localeCompare(b.pack));
}
