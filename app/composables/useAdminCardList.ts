/**
 * The queried card list behind the admin card manager: fetching it, caching
 * it, paginating it, and keeping it in sync after a mutation.
 *
 * Two things here are less obvious than they look:
 *
 *  - **The cache is keyed by the whole query**, and `fetchCards` serves a
 *    stale hit immediately while re-requesting in the background. The result
 *    is only committed if the query hasn't changed in the meantime, so fast
 *    typing in the search box can't land an old response over a newer one.
 *  - **`visibleCards` is deliberately decoupled from `cards` + `currentPage`**
 *    rather than being a computed slice, so paging can show a skeleton for a
 *    tick before the rows swap.
 *
 * Mutations never write to `cards` directly — they go through the small
 * mutator functions below so both the list and its cache stay consistent.
 */
import { ref, watch, nextTick } from "vue";
import { useCardSearch } from "~/composables/useCardSearch";
import type { CardAttachmentConfig } from "~/types/card";

/** A card row as returned by /api/admin/cards/list. */
export interface AdminCard {
  id: string;
  text: string;
  pack?: string;
  active?: boolean;
  /** Black cards only. */
  pick?: number;
  imageKey?: string | null;
  attachment?: CardAttachmentConfig | null;
}

export function useAdminCardList() {
  const { $activityFetch } = useNuxtApp();
  const { searchTerm, cardType, selectedPack } = useCardSearch();

  const cards = ref<AdminCard[]>([]);
  const totalCards = ref(0);
  const loadingCards = ref(false);
  const isFetchingBackground = ref(false);

  /** 0 = any; only meaningful for black cards. */
  const numPick = ref(0);

  const currentPage = ref(1);
  const pageSize = ref(30);
  const visibleCards = ref<AdminCard[]>([]);
  const isPageTransitioning = ref(false);

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

  /** Shift-click: add the inclusive range between the anchor and this card. */
  function selectCardRangeTo(id: string) {
    const anchor = lastClickedId.value;
    if (!anchor || anchor === id) {
      toggleCardSelected(id);
      return;
    }
    const ids = visibleCards.value.map((c) => c.id);
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

  /** Every card the current query loaded — not just the visible page. */
  function selectAllLoaded() {
    selectedCardIds.value = cards.value.map((c) => c.id);
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

  // ── Pagination ───────────────────────────────────────────────────────────
  function sliceCurrentPage() {
    const start = (currentPage.value - 1) * pageSize.value;
    visibleCards.value = cards.value.slice(start, start + pageSize.value);
  }

  // When the full card list refreshes, clamp page to valid range then update slice
  watch(
    cards,
    () => {
      const maxPage = Math.max(
        1,
        Math.ceil(cards.value.length / pageSize.value),
      );
      if (currentPage.value > maxPage) currentPage.value = 1;
      sliceCurrentPage();
    },
    { immediate: true },
  );

  // When user changes page via pagination, show skeleton first → swap cards → hide
  watch(currentPage, async () => {
    if (loadingCards.value) return; // Full fetch already owns the skeleton
    isPageTransitioning.value = true;
    await nextTick();
    sliceCurrentPage();
    isPageTransitioning.value = false;
  });

  // ── Fetching ─────────────────────────────────────────────────────────────
  const fetchCards = async () => {
    const queryType = cardType.value;
    const queryPack = selectedPack.value;
    const queryPick = cardType.value === "black" ? numPick.value : 0;
    const querySearch = searchTerm.value;

    const cacheKey = getCacheKey(queryType, queryPack, queryPick, querySearch);
    // A new query means a new result set; never carry a selection across.
    clearCardSelection();
    const cached = cardListCache.get(cacheKey);

    if (cached) {
      cards.value = cached;
      totalCards.value = cached.length;
      currentPage.value = 1;
      isFetchingBackground.value = true;
    } else if (!cards.value.length) {
      loadingCards.value = true;
    } else {
      isFetchingBackground.value = true;
    }

    try {
      const query: Record<string, string> = { type: queryType };
      if (queryPack) query.pack = queryPack;
      if (queryPick > 0) query.pick = String(queryPick);
      if (querySearch) query.search = querySearch;

      const result = await $activityFetch<AdminCard[]>(
        "/api/admin/cards/list",
        { query },
      );

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

  return {
    cards,
    visibleCards,
    totalCards,
    loadingCards,
    isFetchingBackground,
    isPageTransitioning,
    numPick,
    currentPage,
    pageSize,
    selectedCardIds,
    isCardSelected,
    toggleCardSelected,
    selectCardRangeTo,
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
