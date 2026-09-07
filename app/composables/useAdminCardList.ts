/**
 * The queried card list behind the admin card manager: fetching it, caching
 * it, sorting it, and keeping it in sync after a mutation.
 *
 * Two things here are less obvious than they look:
 *
 *  - **The cache is keyed by the whole query**, and `fetchCards` serves a
 *    stale hit immediately while re-requesting in the background. The result
 *    is only committed if the query hasn't changed in the meantime, so fast
 *    typing in the search box can't land an old response over a newer one.
 *  - **`sortedCards` is a computed view, never an in-place sort** — `cards`
 *    stays in the order the server returned so switching back to "pack"
 *    order never needs a refetch.
 *
 * Mutations never write to `cards` directly — they go through the small
 * mutator functions below so both the list and its cache stay consistent.
 */
import { ref, computed } from "vue";
import { useCardSearch } from "~/composables/useCardSearch";
import type { AdminCardType, AdminCardFilter } from "~/composables/useCardSearch";
import type { CardAttachmentConfig } from "~/types/card";
import { cardRate } from "~/composables/useAdminCardStats";

/** A card row as returned by /api/admin/cards/list. */
export interface AdminCard {
  id: string;
  text: string;
  /** Which table this row came from. Set by fetchCards, never by the server. */
  type: AdminCardType;
  pack?: string;
  active?: boolean;
  /** Black cards only. */
  pick?: number;
  imageKey?: string | null;
  /** Set alongside imageKey; must be round-tripped on edit or the image is lost. */
  imageFormat?: string | null;
  attachment?: CardAttachmentConfig | null;
  /**
   * Written by the game engine and already returned by
   * /api/admin/cards/list — it selects whole rows — but never declared here
   * until now, so nothing in the admin could read them.
   */
  timesPlayed?: number;
  /** White cards. */
  timesWon?: number;
  /** Black cards. */
  timesSkipped?: number;
}

export type AdminCardSort =
  | "pack"
  | "az"
  | "played-desc"
  | "played-asc"
  | "winrate-desc"
  | "skiprate-desc";

export function useAdminCardList() {
  const { $activityFetch } = useNuxtApp();
  const { searchTerm, cardType, selectedPack } = useCardSearch();

  const cards = ref<AdminCard[]>([]);
  const totalCards = ref(0);
  const loadingCards = ref(false);
  const isFetchingBackground = ref(false);

  /** 0 = any; only meaningful for black cards. */
  const numPick = ref(0);

  // ── Selection ─────────────────────────────────────────────────────────────
  // Cleared whenever the query changes, so a move can never be applied to
  // cards the admin has filtered away.
  const selectedCardIds = ref<string[]>([]);
  /** Anchor for shift-click ranges. */
  const lastClickedId = ref<string | null>(null);

  function isCardSelected(id: string) {
    return selectedCardIds.value.includes(id);
  }

  function toggleCardSelected(id: string) {
    const idx = selectedCardIds.value.indexOf(id);
    if (idx === -1) selectedCardIds.value.push(id);
    else selectedCardIds.value.splice(idx, 1);
    lastClickedId.value = id;
  }

  /**
   * Shift-click: add the inclusive range between the anchor and this card.
   *
   * `order` is the on-screen order the range is measured in. It has to be
   * passed by the page, because `sortedCards` is the whole loaded set and the
   * grid shows a chip-filtered slice of it — ranging over `sortedCards` would
   * quietly select cards the admin cannot see. It defaults to `sortedCards`
   * for callers with no filter of their own.
   */
  function selectCardRangeTo(id: string, order?: string[]) {
    const anchor = lastClickedId.value;
    if (!anchor || anchor === id) {
      toggleCardSelected(id);
      return;
    }
    const ids = order ?? sortedCards.value.map((c) => c.id);
    const from = ids.indexOf(anchor);
    const to = ids.indexOf(id);
    if (from === -1 || to === -1) {
      toggleCardSelected(id);
      return;
    }
    const [lo, hi] = from < to ? [from, to] : [to, from];
    const range = ids.slice(lo, hi + 1);
    selectedCardIds.value = [...new Set([...selectedCardIds.value, ...range])];
    lastClickedId.value = id;
  }

  /**
   * Select exactly these ids. The caller decides what "all" means on screen —
   * the selection bar's label is drawn from the visible set, so selecting
   * anything wider than that made the button lie.
   */
  function selectAllOf(ids: string[]) {
    selectedCardIds.value = [...new Set(ids)];
  }

  /** Every card the current query loaded — not just what a chip leaves visible. */
  function selectAllLoaded() {
    selectAllOf(cards.value.map((c) => c.id));
  }

  function clearCardSelection() {
    selectedCardIds.value = [];
    lastClickedId.value = null;
  }

  // ── In-memory query cache ────────────────────────────────────────────────
  const cardListCache = new Map<string, AdminCard[]>();

  function getCacheKey(
    type: string,
    pack?: string,
    pick?: number,
    search?: string,
  ): string {
    return `${type}::${pack || ""}::${pick || 0}::${search || ""}`;
  }

  function invalidateCache() {
    cardListCache.clear();
  }

  /** One typed request, with every row tagged as it lands. */
  async function fetchOneType(
    type: AdminCardType,
    pack: string | undefined,
    pick: number,
    search: string,
  ): Promise<AdminCard[]> {
    const query: Record<string, string> = { type };
    if (pack) query.pack = pack;
    if (pick > 0) query.pick = String(pick);
    if (search) query.search = search;

    const rows = await $activityFetch<Omit<AdminCard, "type">[]>(
      "/api/admin/cards/list",
      { query },
    );
    return rows.map((r) => ({ ...r, type }));
  }

  // ── Fetching ─────────────────────────────────────────────────────────────
  const fetchCards = async () => {
    const queryType = cardType.value;
    const queryPack = selectedPack.value;
    // pick only narrows black cards, and it is meaningless across a merged list
    const queryPick = queryType === "black" ? numPick.value : 0;
    const querySearch = searchTerm.value;

    const cacheKey = getCacheKey(queryType, queryPack, queryPick, querySearch);
    // A new query means a new result set; never carry a selection across.
    clearCardSelection();
    const cached = cardListCache.get(cacheKey);

    if (cached) {
      cards.value = cached;
      totalCards.value = cached.length;
      isFetchingBackground.value = true;
    } else if (!cards.value.length) {
      loadingCards.value = true;
    } else {
      isFetchingBackground.value = true;
    }

    try {
      const result =
        queryType === "all"
          ? (
              await Promise.all([
                fetchOneType("white", queryPack, 0, querySearch),
                fetchOneType("black", queryPack, 0, querySearch),
              ])
            ).flat()
          : await fetchOneType(queryType, queryPack, queryPick, querySearch);

      // Only commit if the query that started this request is still current —
      // otherwise a slow response would clobber a newer, narrower result.
      const stillCurrent =
        cardType.value === queryType &&
        selectedPack.value === queryPack &&
        (cardType.value !== "black" || numPick.value === queryPick) &&
        searchTerm.value === querySearch;

      if (stillCurrent) {
        cardListCache.set(cacheKey, result);
        cards.value = result;
        totalCards.value = result.length;
      }
    } catch (err) {
      console.error("Failed to fetch cards:", err);
    } finally {
      loadingCards.value = false;
      isFetchingBackground.value = false;
    }
  };

  // ── Local mutators (each invalidates the cache) ──────────────────────────
  function applyCardUpdate(updated: AdminCard) {
    invalidateCache();
    const idx = cards.value.findIndex((c) => c.id === updated.id);
    if (idx !== -1) {
      cards.value[idx] = { ...cards.value[idx], ...updated } as AdminCard;
    }
  }

  function removeCard(id: string) {
    invalidateCache();
    cards.value = cards.value.filter((c) => c.id !== id);
    totalCards.value--;
    selectedCardIds.value = selectedCardIds.value.filter((sid) => sid !== id);
  }

  function prependCard(card: AdminCard) {
    invalidateCache();
    cards.value.unshift(card);
    totalCards.value++;
  }

  function clearList() {
    cards.value = [];
    totalCards.value = 0;
    clearCardSelection();
  }

  /** Reflect a pack-wide activate/deactivate on the rows currently loaded. */
  function setActiveForPack(pack: string, active: boolean) {
    invalidateCache();
    for (const c of cards.value) {
      if (c.pack === pack) c.active = active;
    }
  }

  /**
   * Sorting is a computed view, never an in-place sort: `cards` stays in the
   * order the server returned so "pack" can restore it without a refetch.
   */
  const sort = ref<AdminCardSort>("pack");

  const sortedCards = computed(() => {
    const rows = cards.value;
    if (sort.value === "pack") return rows;
    const copy = [...rows];
    switch (sort.value) {
      case "az":
        return copy.sort((a, b) =>
          (a.text || "").localeCompare(b.text || "", undefined, {
            sensitivity: "base",
          }),
        );
      case "played-desc":
        return copy.sort((a, b) => (b.timesPlayed ?? 0) - (a.timesPlayed ?? 0));
      case "played-asc":
        return copy.sort((a, b) => (a.timesPlayed ?? 0) - (b.timesPlayed ?? 0));
      case "winrate-desc":
      case "skiprate-desc": {
        const kind = sort.value === "winrate-desc" ? "win" : "skip";
        // A card with no rate has no rank — park them all at the end rather
        // than letting a 2-play card top the list.
        return copy.sort((a, b) => {
          const ra = cardRate(a), rb = cardRate(b);
          const va = ra.kind === kind ? ra.value : null;
          const vb = rb.kind === kind ? rb.value : null;
          if (va === null && vb === null) return 0;
          if (va === null) return 1;
          if (vb === null) return -1;
          return vb - va;
        });
      }
      default: {
        // `never` is compile-time only: this still fails to build if a new
        // AdminCardSort member has no case, but at runtime an unrecognised
        // value must degrade to unsorted rather than returning a string.
        const _exhaustive: never = sort.value;
        void _exhaustive;
        return copy;
      }
    }
  });

  return {
    cards,
    totalCards,
    loadingCards,
    isFetchingBackground,
    numPick,
    sort,
    sortedCards,
    selectedCardIds,
    isCardSelected,
    toggleCardSelected,
    selectCardRangeTo,
    selectAllOf,
    selectAllLoaded,
    clearCardSelection,
    fetchCards,
    invalidateCache,
    applyCardUpdate,
    removeCard,
    prependCard,
    clearList,
    setActiveForPack,
  };
}

export type AdminCardList = ReturnType<typeof useAdminCardList>;
