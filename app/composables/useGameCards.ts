import { computed, ref } from "vue";
import { getAppwrite } from "~/utils/appwrite";
import type { GameCards, PlayerHand, CardTexts } from "~/types/gamecards";
import type { CardId, PlayerId } from "~/types/game";
import { resolveId } from "~/utils/resolveId";

export const useGameCards = () => {
  const { client } = getAppwrite();
  const config = useRuntimeConfig();

  // Reactive state
  const gameCards = ref<GameCards | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Map of cardId → { text, pack } resolved server-side.
   * Updated incrementally: new card IDs trigger a /api/cards/resolve call;
   * already-known IDs are never re-fetched within the same game session.
   */
  const cardTexts = ref<CardTexts>({});

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Extract all white card IDs referenced in the current playerHands. */
  function extractHandCardIds(rawHands: string[]): CardId[] {
    const ids: CardId[] = [];
    for (const handString of rawHands) {
      try {
        const hand = JSON.parse(handString) as PlayerHand;
        if (Array.isArray(hand.cards)) ids.push(...hand.cards);
      } catch {
        // malformed entry — skip
      }
    }
    return ids;
  }

  /**
   * Resolve texts for any card IDs not yet in cardTexts.
   * Fires a single POST to /api/cards/resolve with only the unknown IDs,
   * then merges the result into cardTexts.
   */
  async function resolveNewCardTexts(ids: CardId[]): Promise<void> {
    const unknown = ids.filter((id) => !cardTexts.value[id]);
    if (unknown.length === 0) return;

    try {
      const resolved = await $fetch<CardTexts>("/api/cards/resolve", {
        method: "POST",
        body: { cardIds: unknown },
      });
      // Merge — never overwrite already-cached entries
      cardTexts.value = { ...resolved, ...cardTexts.value };
    } catch (err) {
      console.error("[useGameCards] Failed to resolve card texts:", err);
    }
  }

  // ── Computed ─────────────────────────────────────────────────────────────

  const playerHands = computed(() => {
    if (!gameCards.value) return {};

    const handsMap: Record<PlayerId, CardId[]> = {};

    if (
      !gameCards.value.playerHands ||
      !Array.isArray(gameCards.value.playerHands)
    ) {
      console.error(
        "playerHands is not an array:",
        gameCards.value.playerHands,
      );
      return {};
    }

    gameCards.value.playerHands.forEach((handString, index) => {
      try {
        const hand = JSON.parse(handString) as PlayerHand;

        if (!hand.playerId) {
          console.error(`Missing playerId in hand ${index}:`, hand);
          return;
        }

        if (!Array.isArray(hand.cards)) {
          console.error(
            `Cards is not an array for player ${hand.playerId}:`,
            hand.cards,
          );
          handsMap[hand.playerId] = [];
          return;
        }

        handsMap[hand.playerId] = hand.cards;
      } catch (err) {
        console.error(`Failed to parse player hand ${index}:`, handString, err);
      }
    });

    return handsMap;
  });

  // ── Fetch ────────────────────────────────────────────────────────────────

  /** Fetch game cards from server and immediately resolve any unknown card texts. */
  const fetchGameCards = async (lobbyId: string) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<any>(`/api/gamecards/${lobbyId}`);

      if (response.error) {
        error.value = response.error;
        gameCards.value = null;
      } else {
        gameCards.value = response as unknown as GameCards;
        // Kick off text resolution (non-blocking — don't await)
        const ids = extractHandCardIds(gameCards.value.playerHands ?? []);
        resolveNewCardTexts(ids);
      }
    } catch (err) {
      console.error("Failed to fetch game cards:", err);
      error.value = "Failed to fetch game cards";
      gameCards.value = null;
    } finally {
      loading.value = false;
    }
  };

  // ── Realtime ─────────────────────────────────────────────────────────────

  /** Subscribe to real-time updates for game cards. */
  const subscribeToGameCards = (
    lobbyId: string,
    onUpdate?: (cards: GameCards) => void,
  ) => {
    if (!client) return () => {};
    // Fetch + resolve texts for the initial state
    fetchGameCards(lobbyId);

    const dbId = config.public.appwriteDatabaseId as string;
    const collectionId = config.public.appwriteGamecardsCollectionId as string;

    const unsubscribe = client.subscribe(
      [`databases.${dbId}.collections.${collectionId}.documents`],
      ({ events, payload }: { events: string[]; payload: unknown }) => {
        const doc = payload as GameCards & { lobbyId: any };
        const docLobbyId = resolveId(doc.lobbyId);

        if (docLobbyId !== lobbyId) return;

        if (events.some((e) => e.endsWith(".delete"))) {
          gameCards.value = null;
          return;
        }

        if (
          events.some((e) => e.endsWith(".create")) ||
          events.some((e) => e.endsWith(".update"))
        ) {
          gameCards.value = doc as unknown as GameCards;
          // Resolve texts for any new card IDs delivered in this update
          const ids = extractHandCardIds(doc.playerHands ?? []);
          resolveNewCardTexts(ids);
          if (onUpdate) onUpdate(gameCards.value);
        }
      },
    );

    return () => {
      unsubscribe();
    };
  };

  return {
    gameCards,
    playerHands,
    cardTexts,
    loading,
    error,
    fetchGameCards,
    subscribeToGameCards,
  };
};
