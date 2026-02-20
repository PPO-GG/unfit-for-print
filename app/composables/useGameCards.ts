import {computed, ref, onUnmounted} from 'vue';
import {getAppwrite} from '~/utils/appwrite';
import type {GameCards, PlayerHand} from '~/types/gamecards';
import type {CardId, PlayerId} from '~/types/game';

export const useGameCards = () => {
  let databases: ReturnType<typeof getAppwrite>['databases'] | undefined
  let client: ReturnType<typeof getAppwrite>['client'] | undefined
  if (import.meta.client) {
    ({ databases, client } = getAppwrite())
  }
  const config = useRuntimeConfig();

  // Reactive state
  const gameCards = ref<GameCards | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Computed properties
  const playerHands = computed(() => {
    if (!gameCards.value) {
      return {};
    }

    // Convert the array of stringified player hands to an object
    const handsMap: Record<PlayerId, CardId[]> = {};

    if (!gameCards.value.playerHands || !Array.isArray(gameCards.value.playerHands)) {
      console.error('playerHands is not an array:', gameCards.value.playerHands);
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
          console.error(`Cards is not an array for player ${hand.playerId}:`, hand.cards);
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

  // Fetch game cards for a specific lobby
  const fetchGameCards = async (lobbyId: string) => {
    loading.value = true;
    error.value = null;

    try {
      // Use the server-side API endpoint instead of direct Appwrite access
      const response = await $fetch<any>(`/api/gamecards/${lobbyId}`);

      if (response.error) {
        error.value = response.error;
        gameCards.value = null;
      } else {
        gameCards.value = response as unknown as GameCards;
      }
    } catch (err) {
      console.error('Failed to fetch game cards:', err);
      error.value = 'Failed to fetch game cards';
      gameCards.value = null;
    } finally {
      loading.value = false;
    }
  };

  // Subscribe to real-time updates for game cards
  const subscribeToGameCards = (lobbyId: string, onUpdate?: (cards: GameCards) => void) => {
    if (!client) return () => {}
    // First fetch the initial data
    fetchGameCards(lobbyId);

    const dbId = config.public.appwriteDatabaseId as string;
    const collectionId = config.public.appwriteGamecardsCollectionId as string;

    // Subscribe to changes in the gamecards collection
    const unsubscribe = client.subscribe(
      [`databases.${dbId}.collections.${collectionId}.documents`],
      ({ events, payload }) => {
        const doc = payload as GameCards & { lobbyId: any };
        const docLobbyId = typeof doc.lobbyId === 'object' && doc.lobbyId?.$id
          ? doc.lobbyId.$id
          : doc.lobbyId;

        if (docLobbyId !== lobbyId) return;

        if (events.some(e => e.endsWith('.delete'))) {
          gameCards.value = null;
          return;
        }

        if (events.some(e => e.endsWith('.create')) || events.some(e => e.endsWith('.update'))) {
          gameCards.value = doc as unknown as GameCards;
          if (onUpdate) onUpdate(gameCards.value);
        }
      }
    );

    // Automatically clean up when the component using this composable unmounts
    onUnmounted(() => {
      unsubscribe();
    });

    // Return a function to clean up the subscription
    return () => {
      unsubscribe();
    };
  };

  return {
    gameCards,
    playerHands,
    loading,
    error,
    fetchGameCards,
    subscribeToGameCards
  };
};
