// composables/usePlayers.ts
import type { Player } from "~/types/player";

export const usePlayers = () => {
  const { $activityFetch } = useNuxtApp();

  const getPlayersForLobby = async (lobbyId: string): Promise<Player[]> => {
    try {
      return await $activityFetch<Player[]>("/api/players/list", {
        query: { lobbyId },
      });
    } catch (err) {
      console.error("Failed to fetch players for lobby:", err);
      return [];
    }
  };

  const updatePlayerAvatar = async (
    playerId: string,
    avatarUrl: string | null,
  ) => {
    try {
      await $activityFetch("/api/players/avatar", {
        method: "POST",
        body: { playerId, avatarUrl },
      });
    } catch (err) {
      console.error("Failed to update player avatar:", err);
    }
  };

  return {
    getPlayersForLobby,
    updatePlayerAvatar,
  };
};
