// server/api/game/play-card.post.ts
// Replaces the Appwrite Function: functions/playCard/src/main.js
import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, playerId, cardIds, userId } = body;

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
  if (!cardIds || !Array.isArray(cardIds)) {
    throw createError({
      statusCode: 400,
      statusMessage: "cardIds must be an array",
    });
  }

  // Auth: Caller must be this player in this lobby
  await verifyPlayerInLobby(userId, lobbyId);
  if (userId !== playerId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Cannot play cards for another player",
    });
  }

  const { DB, LOBBY, GAMECARDS } = getCollectionIds();
  const databases = getAdminDatabases();

  return withRetry(async () => {
    try {
      // --- Fetch lobby and decode state ---
      const lobby = await databases.getDocument(DB, LOBBY, lobbyId);
      const capturedVersion = lobby.$updatedAt;
      const state = decodeGameState(lobby.gameState);

      // --- Fetch gamecards document ---
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

      // --- Merge player hands from gamecards ---
      state.hands = parsePlayerHands(gameCards.playerHands);

      // --- Validations ---
      if (state.phase !== "submitting") {
        throw createError({
          statusCode: 400,
          statusMessage: "Not accepting submissions",
        });
      }
      if (state.judgeId === playerId) {
        throw createError({
          statusCode: 400,
          statusMessage: "Czar cannot play",
        });
      }
      if (state.submissions[playerId]) {
        throw createError({
          statusCode: 400,
          statusMessage: "Already submitted",
        });
      }
      if (!state.hands[playerId]) {
        throw createError({
          statusCode: 400,
          statusMessage: "Player not found in hands",
        });
      }

      // --- Remove cards from hand ---
      for (const id of cardIds) {
        const idx = state.hands[playerId].indexOf(id);
        if (idx < 0) {
          throw createError({
            statusCode: 400,
            statusMessage: `Card ${id} not in hand`,
          });
        }
        state.hands[playerId].splice(idx, 1);
      }

      // --- Record submission ---
      state.submissions[playerId] = cardIds;

      // --- Check if all players have submitted ---
      const skippedPlayers: string[] = state.skippedPlayers || [];
      const toPlay = Object.keys(state.hands).filter(
        (id) => id !== state.judgeId && !skippedPlayers.includes(id),
      );
      if (Object.keys(state.submissions).length === toPlay.length) {
        state.phase = "judging";
      }

      // --- Prepare updated documents ---
      const updatedGameCards = {
        lobbyId: gameCards.lobbyId,
        whiteDeck: gameCards.whiteDeck,
        blackDeck: gameCards.blackDeck,
        discardWhite: gameCards.discardWhite,
        discardBlack: gameCards.discardBlack,
        playerHands: serializePlayerHands(state.hands),
      };

      const coreState = extractCoreState(state);

      // --- Concurrency check + Persist ---
      await assertVersionUnchanged(lobbyId, capturedVersion);
      await databases.updateDocument(
        DB,
        GAMECARDS,
        gameCards.$id,
        updatedGameCards,
      );
      await databases.updateDocument(DB, LOBBY, lobbyId, {
        gameState: encodeGameState(coreState),
      });

      return { success: true };
    } catch (err: any) {
      if (err.statusCode) throw err;
      throw createError({ statusCode: 500, statusMessage: err.message });
    }
  });
});
