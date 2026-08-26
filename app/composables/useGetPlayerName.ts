import { ref, computed } from "vue";
import type { Player } from "~/types/player";

/**
 * Composable for getting a player's name by their ID without needing to pass players array
 *
 * @returns A function to get player name by ID
 */
export const useGetPlayerName = () => {
  const { $activityFetch } = useNuxtApp();

  // Cache for players to avoid repeated database queries
  const playerCache = ref<Record<string, Player>>({});
  const isLoading = ref(false);

  /**
   * Fetch a player by userId from the database
   *
   * @param userId - The user ID to look up
   * @returns The player object or null if not found
   */
  const fetchPlayerByUserId = async (
    userId: string,
  ): Promise<Player | null> => {
    try {
      // If we already have this player in cache, return it
      if (playerCache.value[userId]) {
        return playerCache.value[userId];
      }

      isLoading.value = true;

      const player = await $activityFetch<Player | null>(
        "/api/players/by-user/" + userId,
      );

      if (player) {
        // Add to cache
        playerCache.value[userId] = player;
        return player;
      }

      return null;
    } catch (err) {
      console.error("Failed to fetch player by userId:", err);
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Get a player's name by their ID
   *
   * @param playerId - The ID of the player to look up
   * @returns The player's name or a fallback string
   */
  const getPlayerName = async (playerId: string | null): Promise<string> => {
    // Handle null playerId
    if (!playerId) return "Unknown Player";

    try {
      // Try to get from cache first
      if (playerCache.value[playerId]?.name) {
        return playerCache.value[playerId].name;
      }

      // If not in cache, fetch from database
      const player = await fetchPlayerByUserId(playerId);
      if (player?.name) {
        return player.name;
      }

      // If still not found, try fetching by row id instead of userId
      // This is a fallback for cases where playerId might be the document ID
      try {
        const doc = await $activityFetch<Player | null>(
          "/api/players/" + playerId,
        );

        if (doc?.name) {
          // Cache this player
          playerCache.value[doc.userId] = doc;
          return doc.name;
        }
      } catch (err) {
        // Document not found or other error, continue to fallback
      }

      return "Unknown Player";
    } catch (err) {
      console.error("Error in getPlayerName:", err);
      return "Unknown Player";
    }
  };

  /**
   * Synchronous version that returns cached player name or a placeholder
   * while the async lookup happens in the background
   *
   * @param playerId - The ID of the player to look up
   * @returns The player's name from cache or a temporary placeholder
   */
  const getPlayerNameSync = (playerId: string | null): string => {
    if (!playerId) return "Unknown Player";

    // If we have it in cache, return immediately
    if (playerCache.value[playerId]?.name) {
      return playerCache.value[playerId].name;
    }

    // Start async fetch in background if not already loading
    if (!isLoading.value) {
      fetchPlayerByUserId(playerId).catch(console.error);
    }

    // Return a temporary value while loading
    return "Loading...";
  };

  return {
    getPlayerName,
    getPlayerNameSync,
    fetchPlayerByUserId,
    playerCache: computed(() => playerCache.value),
  };
};
