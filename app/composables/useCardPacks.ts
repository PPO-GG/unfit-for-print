/**
 * Shared, load-once roster of the card packs a player can browse.
 *
 * Two consumers on the Labs page need this at the same time: the hero stats
 * (Labs-pack card count, enabled pack count — both must be right before anyone
 * opens the Card Packs tab) and the browser's pack gallery. Both call `load()`;
 * the in-flight promise below collapses that into a single pair of requests.
 *
 * Counts are *active* cards only, matching `/api/cards/browse`, so a pack tile
 * never advertises more cards than the browser will actually list.
 */

import {
  buildPackGallery,
  countLabsCards,
  type PackMetaRow,
  type PackStat,
  type PackTile,
} from "~/utils/cardPacks";
import { commonPackPrefix } from "~/utils/packName";

let inFlight: Promise<void> | null = null;

export function useCardPacks() {
  const tiles = useState<PackTile[]>("card-packs-tiles", () => []);
  const loading = useState("card-packs-loading", () => false);
  const loaded = useState("card-packs-loaded", () => false);

  const totalCards = computed(() =>
    tiles.value.reduce((sum, tile) => sum + tile.total, 0),
  );

  // Enabled packs only: `fetchRoster` asks for `activeOnly`, and
  // `buildPackGallery` drops anything left with no active cards.
  const packCount = computed(() => tiles.value.length);

  const labsCards = computed(() => countLabsCards(tiles.value));

  /**
   * The series most of the roster shares, derived the same way the admin
   * Packs screen derives it. 106 of the 111 real packs begin "Cards Against
   * Humanity:", so without this every gallery tile leads with the same words
   * and the half that identifies the pack is what gets cut.
   */
  const seriesPrefix = computed(() =>
    commonPackPrefix(tiles.value.map((tile) => tile.pack)),
  );

  // Same fetcher resolution as useCardTexts: prefer $activityFetch so the
  // Discord Activity's auth headers ride along, fall back to $fetch outside a
  // Nuxt app context (unit tests).
  function resolveFetcher(): typeof $fetch {
    let fetcher: typeof $fetch =
      typeof $fetch !== "undefined" ? $fetch : (globalThis as any).$fetch;
    try {
      const nuxtApp = useNuxtApp();
      if ((nuxtApp as any)?.$activityFetch) {
        fetcher = (nuxtApp as any).$activityFetch;
      }
    } catch {
      // Outside Nuxt app context (e.g. unit tests)
    }
    return fetcher;
  }

  async function fetchRoster() {
    const fetcher = resolveFetcher();
    const [packs, defaults] = await Promise.all([
      // activeOnly keeps packs an admin has switched off out of the response
      // entirely, rather than shipping their names to the browser for
      // buildPackGallery to drop.
      fetcher<{ white: PackStat[]; black: PackStat[]; meta?: PackMetaRow[] }>(
        "/api/cards/packs",
        { query: { activeOnly: 1 } },
      ),
      fetcher<{ packs: string[] }>("/api/cards/default-packs"),
    ]);
    tiles.value = buildPackGallery(packs, defaults?.packs ?? [], packs?.meta ?? []);
    loaded.value = true;
  }

  async function load(options: { force?: boolean } = {}) {
    if (loaded.value && !options.force) return;
    if (inFlight && !options.force) return inFlight;

    loading.value = true;
    inFlight = fetchRoster()
      .catch((error) => {
        // A failed roster leaves `loaded` false so a later call can retry.
        console.error("Error loading card packs:", error);
      })
      .finally(() => {
        loading.value = false;
        inFlight = null;
      });

    return inFlight;
  }

  /** Test seam: drops the module-level in-flight promise between suites. */
  function reset() {
    inFlight = null;
  }

  return {
    tiles,
    totalCards,
    packCount,
    labsCards,
    seriesPrefix,
    loading,
    loaded,
    load,
    reset,
  };
}
