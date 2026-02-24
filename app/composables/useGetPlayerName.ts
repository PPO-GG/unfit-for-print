import { ref, computed } from "vue";
import { Query } from "appwrite";
import { getAppwrite } from "~/utils/appwrite";
import type { Player } from "~/types/player";

/**
 * Composable for getting a player's name by their ID without needing to pass players array
 *
 * @returns A function to get player name by ID
 */
export const useGetPlayerName = () => {
  // Cache for players to avoid repeated database queries
  const playerCache = ref<Record<string, Player>>({});
  const isLoading = ref(false);

  // Get runtime config
  const getConfig = () => useRuntimeConfig();

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
      const { databases, tables } = getAppwrite();
      const config = getConfig();

      // Query the player collection for this userId
      const res = await tables.listRows({
        databaseId: config.public.appwriteDatabaseId,
        tableId: config.public.appwritePlayerCollectionId,
        queries: [Query.equal("userId", userId)],
      });

      if (res.rows.length > 0) {
        const row = res.rows[0]!;
        // Convert to Player type and cache it
        const player = {
          $id: row.$id,
          userId: row.userId,
          lobbyId: row.lobbyId,
          name: row.name,
          avatar: row.avatar,
          isHost: row.isHost,
          joinedAt: row.joinedAt,
          provider: row.provider,
        } as Player;

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

      // If still not found, try fetching by $id instead of userId
      // This is a fallback for cases where playerId might be the document ID
      const { databases, tables } = getAppwrite();
      const config = getConfig();

      try {
        const doc = await tables.getRow({
          databaseId: config.public.appwriteDatabaseId,
          tableId: config.public.appwritePlayerCollectionId,
          rowId: playerId,
        });

        if (doc?.name) {
          // Cache this player
          playerCache.value[doc.userId] = {
            $id: doc.$id,
            userId: doc.userId,
            lobbyId: doc.lobbyId,
            name: doc.name,
            avatar: doc.avatar,
            isHost: doc.isHost,
            joinedAt: doc.joinedAt,
            provider: doc.provider,
          } as Player;

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
