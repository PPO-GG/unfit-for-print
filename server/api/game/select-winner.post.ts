// server/api/game/select-winner.post.ts
// Replaces the Appwrite Function: functions/selectWinner/src/main.js
import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, winnerId, userId } = body;

  if (!lobbyId)
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });
  if (!winnerId)
    throw createError({
      statusCode: 400,
      statusMessage: "winnerId is required",
    });

  // Auth: Caller must be a player in this lobby (judge check is below)
  await verifyPlayerInLobby(userId, lobbyId);

  const { DB, LOBBY, GAMECARDS } = getCollectionIds();
  const databases = getAdminDatabases();
  const tables = getAdminTables();

  return withRetry(async () => {
    try {
      // --- Fetch lobby and decode state ---
      const lobby = await tables.getRow({ databaseId: DB, tableId: LOBBY, rowId: lobbyId });
      const capturedVersion = lobby.$updatedAt;
      const state = decodeGameState(lobby.gameState);

      // --- Fetch gamecards document ---
      const gameCardsQuery = await tables.listRows({ databaseId: DB, tableId: GAMECARDS, queries: [
                  Query.equal("lobbyId", lobbyId),
                ] });
      if (gameCardsQuery.rows.length === 0) {
        throw createError({
          statusCode: 404,
          statusMessage: `No gamecards document found for lobby ${lobbyId}`,
        });
      }
      const gameCards = gameCardsQuery.rows[0]!;

      // Merge discard piles from gameCards
      state.discardWhite = gameCards.discardWhite || [];
      state.discardBlack = gameCards.discardBlack || [];

      // --- Validation ---
      if (state.phase !== "judging") {
        throw createError({
          statusCode: 400,
          statusMessage: "Not in judging phase",
        });
      }

      // --- Award point ---
      state.scores[winnerId] = (state.scores[winnerId] || 0) + 1;

      // --- Store winning cards BEFORE clearing submissions ---
      if (state.submissions && state.submissions[winnerId]) {
        state.winningCards = state.submissions[winnerId];
      } else {
        state.winningCards = [];
      }

      // --- Discard played white cards ---
      Object.values(state.submissions as Record<string, string[]>)
        .flat()
        .forEach((id: string) => state.discardWhite.push(id));

      // --- Discard the black card ---
      if (state.blackCard?.id) {
        state.discardBlack.push(state.blackCard.id);
      }

      // --- Clear submissions ---
      state.submissions = {};

      // --- Check win condition ---
      const maxScore = Math.max(
        ...Object.values(state.scores as Record<string, number>),
      );
      const winScore = state.config?.maxPoints || 10;

      if (maxScore >= winScore) {
        state.phase = "complete";
        state.roundWinner = winnerId;
        state.roundEndStartTime = null;
        state.gameEndTime = Date.now();
      } else {
        state.phase = "roundEnd";
        state.roundWinner = winnerId;
        state.roundEndStartTime = Date.now();
      }

      // --- Prepare updated documents ---
      const updatedGameCards = {
        lobbyId: gameCards.lobbyId,
        whiteDeck: gameCards.whiteDeck,
        blackDeck: gameCards.blackDeck,
        discardWhite: state.discardWhite,
        discardBlack: state.discardBlack,
        playerHands: gameCards.playerHands,
      };

      const coreState = extractCoreState(state);

      // --- Concurrency check + Persist ---
      await assertVersionUnchanged(lobbyId, capturedVersion);
      await tables.updateRow({ databaseId: DB, tableId: GAMECARDS, rowId: gameCards.$id, data: updatedGameCards });
      await tables.updateRow({ databaseId: DB, tableId: LOBBY, rowId: lobbyId, data: {
                  status: state.phase === "complete" ? "complete" : "playing",
                  gameState: encodeGameState(coreState),
                } });

      return {
        success: true,
        phase: state.phase,
        winningCards: state.winningCards || [],
      };
    } catch (err: any) {
      if (err.statusCode) throw err;
      throw createError({ statusCode: 500, statusMessage: err.message });
    }
  });
});
