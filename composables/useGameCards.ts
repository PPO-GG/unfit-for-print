import {computed, ref} from 'vue';
import {getAppwrite} from '~/utils/appwrite';
import type {GameCards, PlayerHand} from '~/types/gamecards';
import type {CardId, PlayerId} from '~/types/game';

export const useGameCards = () => {
  const { databases, client } = getAppwrite();
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
    // First fetch the initial data
    fetchGameCards(lobbyId);

    // Set up polling for updates every 3 seconds
    const pollingInterval = setInterval(async () => {
      try {
        const response = await $fetch<any>(`/api/gamecards/${lobbyId}`);

        if (!response.error) {
          const newGameCards = response as unknown as GameCards;

          // Only update if the data has changed
          if (JSON.stringify(newGameCards) !== JSON.stringify(gameCards.value)) {
            gameCards.value = newGameCards;
            if (onUpdate) onUpdate(gameCards.value);
          }
        }
      } catch (err) {
        console.error('Failed to poll game cards:', err);
      }
    }, 3000);

    // Return a function to clear the interval when unsubscribing
    return () => {
      clearInterval(pollingInterval);
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
