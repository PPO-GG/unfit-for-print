// composables/useCardTexts.ts
// Card-text resolution for the game UI.
//
// Only BLACK card texts travel through the Y.Doc — nextRound() needs them
// synchronously inside a transact(). White texts are resolved on demand here,
// per client, for the ~10 cards that client actually displays.
//
// This is why the doc no longer carries every white card's text: that payload
// was what pushed Y.Doc updates toward Teleportal's ~64KB limit and forced the
// cardTexts_0…N chunking in the first place.
//
// Usage:
//   const { cardTexts } = useCardTexts(lobbyDoc, neededIds)
//   // cardTexts.value[cardId]?.text

import { ref, computed, watch, onUnmounted, getCurrentInstance } from "vue";
import type { Ref } from "vue";
import type { LobbyDocResult } from "~/composables/useLobbyDoc";
import type { CardTexts } from "~/types/gamecards";
import { mergeCardTextKeys } from "~/utils/cardTexts";

/** /api/cards/resolve accepts at most 500 ids per request. */
const RESOLVE_BATCH_SIZE = 500;

interface ResolvedCardRow {
  id: string;
  text: string | null;
  pack: string | null;
  packDisplayName?: string | null;
  packSeries?: string | null;
  pick?: number | null;
}

export function useCardTexts(
  lobbyDoc: LobbyDocResult,
  neededIds: Ref<string[]>,
  neededBlackIds?: Ref<string[]>,
) {
  /** Texts embedded in the Y.Doc — only legacy docs still carry any. */
  const docTexts = ref<CardTexts>({});
  /** Texts this client fetched itself. Never written back to the doc. */
  const resolved = ref<CardTexts>({});
  /** Ids with a request in flight, so a re-render doesn't refetch them. */
  const inFlight = new Set<string>();

  let unobserve: (() => void) | null = null;

  const readDocTexts = () => {
    if (!lobbyDoc.doc.value) {
      docTexts.value = {};
      return;
    }
    try {
      docTexts.value = mergeCardTextKeys(
        Object.fromEntries(lobbyDoc.getCards().entries()),
      );
    } catch {
      docTexts.value = {};
    }
  };

  const cleanupObserver = () => {
    if (unobserve) {
      try {
        unobserve();
      } catch {
        /* provider may be destroyed */
      }
      unobserve = null;
    }
  };

  const setupObserver = () => {
    cleanupObserver();
    readDocTexts();
    if (!lobbyDoc.doc.value) return;
    try {
      const cards = lobbyDoc.getCards();
      const handler = () => readDocTexts();
      cards.observe(handler);
      unobserve = () => cards.unobserve(handler);
    } catch {
      /* doc destroyed between the check and the observe */
    }
  };

  const resolveMissing = async (
    ids: string[],
    type?: "black",
  ): Promise<void> => {
    if (ids.length === 0) return;
    ids.forEach((id) => inFlight.add(id));

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

    try {
      for (let i = 0; i < ids.length; i += RESOLVE_BATCH_SIZE) {
        const batch = ids.slice(i, i + RESOLVE_BATCH_SIZE);
        const rows = await fetcher<ResolvedCardRow[]>("/api/cards/resolve", {
          method: "POST",
          body: { ids: batch, type },
        });
        if (!Array.isArray(rows)) continue;
        const merged: CardTexts = { ...resolved.value };
        for (const row of rows) {
          merged[row.id] = {
            text: row.text ?? "",
            pack: row.pack ?? "",
            packDisplayName: row.packDisplayName ?? null,
            packSeries: row.packSeries ?? null,
            ...(typeof row.pick === "number" ? { pick: row.pick } : {}),
          };
        }
        resolved.value = merged;
      }
    } catch (err) {
      // Non-fatal: the card renders blank and the next needed-id change
      // retries it. Never let this reject into a render.
      console.warn("[useCardTexts] Failed to resolve card texts:", err);
    } finally {
      ids.forEach((id) => inFlight.delete(id));
    }
  };

  watch(() => lobbyDoc.doc.value, setupObserver, { immediate: true });

  const missingFrom = (ids: string[]): string[] => [
    ...new Set(
      ids.filter(
        (id) =>
          id &&
          !docTexts.value[id] &&
          !resolved.value[id] &&
          !inFlight.has(id),
      ),
    ),
  ];

  // White and black ids go in separate requests: /api/cards/resolve queries one
  // table per call, and only the black query returns `pick`.
  watch(
    [neededIds, neededBlackIds ?? ref([]), docTexts],
    () => {
      const missingWhite = missingFrom(neededIds.value);
      if (missingWhite.length > 0) void resolveMissing(missingWhite);

      const missingBlack = missingFrom(neededBlackIds?.value ?? []);
      if (missingBlack.length > 0) void resolveMissing(missingBlack, "black");
    },
    { immediate: true, deep: true },
  );

  if (getCurrentInstance()) {
    onUnmounted(cleanupObserver);
  }

  /** Doc entries win: they carry `pick` for black cards. */
  const cardTexts = computed<CardTexts>(() => ({
    ...resolved.value,
    ...docTexts.value,
  }));

  return { cardTexts };
}
