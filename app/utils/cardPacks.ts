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

export interface PickRandomPacksOptions {
  /** Lower bound on combined white+black cards. */
  min?: number;
  /** Upper bound on combined white+black cards. */
  max?: number;
  /**
   * Floor on black cards in the result. Not a crash guard for its own sake —
   * `game/start.post.ts` throws when the selection yields no black cards at
   * all — but the engine reshuffles the black discard once the deck empties,
   * so a thin black count means the same prompts come back round after round.
   */
  minBlack?: number;
  /**
   * Floor on how many packs the roll returns. Without it the greedy fill stops
   * the moment the card floor is met, so drawing CAH Base Set (~1400 cards) or
   * Card Lab first hands the host a single pack — a valid card count and a
   * pointless shuffle.
   */
  minPacks?: number;
  /** Current selection; an identical roll is re-rolled once. */
  exclude?: string[];
  /** Injectable for deterministic tests. */
  rng?: () => number;
}

function shuffleTiles(tiles: PackTile[], rng: () => number): PackTile[] {
  const out = [...tiles];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function samePackSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((pack) => set.has(pack));
}

function rollOnce(
  eligible: PackTile[],
  min: number,
  max: number,
  minBlack: number,
  minPacks: number,
  rng: () => number,
): PackTile[] {
  const order = shuffleTiles(eligible, rng);
  const picked: PackTile[] = [];
  let total = 0;
  let black = 0;

  for (const tile of order) {
    if (total >= min && picked.length >= minPacks) break;
    // A pack that would breach the ceiling is passed over, not accepted — a
    // later, smaller pack may still fit.
    if (total + tile.total > max) continue;
    picked.push(tile);
    total += tile.total;
    black += tile.black;
  }

  // Nothing fit under the ceiling (one pack larger than the whole budget, say).
  // An over-budget deck beats an empty one.
  if (picked.length === 0) {
    const smallest = order.reduce((a, b) => (b.total < a.total ? b : a));
    picked.push(smallest);
    black += smallest.black;
  }

  // Top up blacks. Deliberately ignores `max`: a deck the host can't play is
  // worse than one slightly over budget.
  if (black < minBlack) {
    const chosen = new Set(picked.map((t) => t.pack));
    const donors = order
      .filter((t) => !chosen.has(t.pack) && t.black > 0)
      .sort((a, b) => b.black - a.black);
    for (const donor of donors) {
      if (black >= minBlack) break;
      picked.push(donor);
      black += donor.black;
    }
  }

  return picked;
}

/**
 * Picks a random spread of packs whose combined card count lands inside
 * `min`–`max`, for the host's "Shuffle packs" control.
 *
 * The contract that matters is playability, not randomness: a roll that hits
 * the card budget with white-only packs would 500 `game/start.post.ts`, so the
 * black-card floor is enforced after the budget, not traded against it.
 */
export function pickRandomPacks(
  tiles: PackTile[],
  options: PickRandomPacksOptions = {},
): string[] {
  const {
    min = 1000,
    max = 2000,
    minBlack = 25,
    minPacks = 3,
    exclude,
    rng = Math.random,
  } = options;

  const eligible = tiles.filter((tile) => tile.total > 0);
  if (eligible.length === 0) return [];

  let picked = rollOnce(eligible, min, max, minBlack, minPacks, rng).map(
    (t) => t.pack,
  );

  // Clicking Shuffle and seeing the same chips light up reads as a dead button.
  if (exclude?.length && samePackSet(picked, exclude)) {
    const retry = rollOnce(eligible, min, max, minBlack, minPacks, rng).map(
      (t) => t.pack,
    );
    if (!samePackSet(retry, picked)) picked = retry;
  }

  return picked;
}
