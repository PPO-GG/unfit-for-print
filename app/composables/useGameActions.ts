// composables/useGameActions.ts
// Game action composable — calls Nuxt server API routes instead of Appwrite Functions.

export function useGameActions() {
  const startGame = async (payload: string) => {
    try {
      // The payload comes in as a JSON string from useLobby.ts, parse it for $fetch
      const body = typeof payload === "string" ? JSON.parse(payload) : payload;
      return await $fetch("/api/game/start", { method: "POST", body });
    } catch (error) {
      console.error("Error in startGame:", error);
      throw error;
    }
  };

  const playCard = async (
    lobbyId: string,
    playerId: string,
    cardIds: string[],
  ) => {
    try {
      return await $fetch("/api/game/play-card", {
        method: "POST",
        body: { lobbyId, playerId, cardIds },
      });
    } catch (error) {
      console.error("Error in playCard:", error);
      throw error;
    }
  };

  const selectWinner = async (lobbyId: string, winnerId: string) => {
    try {
      const result = await $fetch<{
        success: boolean;
        phase: string;
        winningCards: string[];
      }>("/api/game/select-winner", {
        method: "POST",
        body: { lobbyId, winnerId },
      });
      return result;
    } catch (error) {
      console.error("Error in selectWinner:", error);
      throw error;
    }
  };

  const startNextRound = async (lobbyId: string, documentId?: string) => {
    if (!lobbyId) {
      console.error("startNextRound called with no lobbyId");
      throw new Error("No lobbyId provided to startNextRound");
    }

    try {
      const result = await $fetch<{ success: boolean; message?: string }>(
        "/api/game/next-round",
        {
          method: "POST",
          body: {
            lobbyId: lobbyId.toString(),
            documentId: documentId?.toString(),
          },
        },
      );

      return {
        success: result.success,
        status: result.success ? "completed" : "failed",
        ...(result.message ? { message: result.message } : {}),
      };
    } catch (error) {
      console.error("Error in startNextRound:", error);
      throw error;
    }
  };

  return { startGame, playCard, selectWinner, startNextRound };
}
