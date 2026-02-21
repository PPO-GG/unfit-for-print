// server/api/game/skip-player.post.ts
// Allows the host or judge to skip an unresponsive player during submission phase.
// The skipped player doesn't submit this round. If all remaining players
// have submitted or been skipped, the game advances to judging.
import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, playerId, userId } = body;

  if (!lobbyId)
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });
  if (!playerId)
    throw createError({
      statusCode: 400,
      statusMessage: "playerId is required",
    });

  // Auth: Caller must be a player in this lobby
  await verifyPlayerInLobby(userId, lobbyId);

  const { DB, LOBBY, GAMECARDS } = getCollectionIds();
  const databases = getAdminDatabases();

  return withRetry(async () => {
    try {
      // --- Fetch lobby and decode state ---
      const lobby = await databases.getDocument(DB, LOBBY, lobbyId);
      const capturedVersion = lobby.$updatedAt;
      const state = decodeGameState(lobby.gameState);

      // --- Validations ---
      if (state.phase !== "submitting") {
        throw createError({
          statusCode: 400,
          statusMessage: "Can only skip players during submission phase",
        });
      }

      if (playerId === state.judgeId) {
        throw createError({
          statusCode: 400,
          statusMessage: "Cannot skip the judge",
        });
      }

      if (state.submissions?.[playerId]) {
        throw createError({
          statusCode: 400,
          statusMessage: "Player has already submitted",
        });
      }

      // --- Fetch gamecards for hands info ---
      const gameCardsQuery = await databases.listDocuments(DB, GAMECARDS, [
        Query.equal("lobbyId", lobbyId),
      ]);
      if (gameCardsQuery.documents.length === 0) {
        throw createError({
          statusCode: 404,
          statusMessage: `No gamecards document found for lobby ${lobbyId}`,
        });
      }
      const gameCards = gameCardsQuery.documents[0]!;
      state.hands = parsePlayerHands(gameCards.playerHands);

      // --- Add player to skippedPlayers ---
      state.skippedPlayers = state.skippedPlayers || [];
      if (!state.skippedPlayers.includes(playerId)) {
        state.skippedPlayers.push(playerId);
      }

      // --- Check if all non-judge, non-skipped players have submitted ---
      const playersWhoMustSubmit = Object.keys(state.hands).filter(
        (id) => id !== state.judgeId && !state.skippedPlayers.includes(id),
      );
      const allSubmitted =
        playersWhoMustSubmit.length > 0 &&
        playersWhoMustSubmit.every((id) => state.submissions?.[id]);

      if (allSubmitted) {
        state.phase = "judging";
      }

      // --- Concurrency check + Persist ---
      const coreState = extractCoreState(state);
      await assertVersionUnchanged(lobbyId, capturedVersion);
      await databases.updateDocument(DB, LOBBY, lobbyId, {
        gameState: encodeGameState(coreState),
      });

      return {
        success: true,
        skippedPlayer: playerId,
        advancedToJudging: allSubmitted,
      };
    } catch (err: any) {
      if (err.statusCode) throw err;
      throw createError({ statusCode: 500, statusMessage: err.message });
    }
  });
});
