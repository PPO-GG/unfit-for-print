// server/api/game/skip-judge.post.ts
// Allows the host to skip an unresponsive judge during the judging phase.
// Discards all submitted white cards and the black card,
// then advances to roundEnd with no winner so the next round starts.
import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, userId } = body;

  if (!lobbyId)
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });

  // Auth: Caller must be the host
  await verifyHost(userId, lobbyId);

  const { DB, LOBBY, GAMECARDS } = getCollectionIds();
  const databases = getAdminDatabases();
  const tables = getAdminTables();

  return withRetry(async () => {
    try {
      // --- Fetch lobby and decode state ---
      const lobby = await tables.getRow({
        databaseId: DB,
        tableId: LOBBY,
        rowId: lobbyId,
      });
      const capturedVersion = lobby.$updatedAt;
      const state = decodeGameState(lobby.gameState);

      // --- Validation ---
      if (state.phase !== "judging") {
        throw createError({
          statusCode: 400,
          statusMessage: "Can only skip the judge during judging phase",
        });
      }

      // --- Fetch gamecards document ---
      const gameCardsQuery = await tables.listRows({
        databaseId: DB,
        tableId: GAMECARDS,
        queries: [Query.equal("lobbyId", lobbyId)],
      });
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

      // --- Discard all submitted white cards ---
      if (state.submissions) {
        Object.values(state.submissions as Record<string, string[]>)
          .flat()
          .forEach((id: string) => state.discardWhite.push(id));
      }

      // --- Discard the black card ---
      if (state.blackCard?.id) {
        state.discardBlack.push(state.blackCard.id);
      }

      // --- Clear submissions and advance to roundEnd ---
      state.submissions = {};
      state.phase = "roundEnd";
      state.roundWinner = null; // No winner this round
      state.winningCards = null;
      state.roundEndStartTime = Date.now();
      state.revealedCards = {};

      // --- Persist ---
      const updatedGameCards = {
        lobbyId: gameCards.lobbyId,
        whiteDeck: gameCards.whiteDeck,
        blackDeck: gameCards.blackDeck,
        discardWhite: state.discardWhite,
        discardBlack: state.discardBlack,
        playerHands: gameCards.playerHands,
      };

      const coreState = extractCoreState(state);

      await assertVersionUnchanged(lobbyId, capturedVersion);
      // Write LOBBY first (consistent write-order pattern)
      await tables.updateRow({
        databaseId: DB,
        tableId: LOBBY,
        rowId: lobbyId,
        data: { gameState: encodeGameState(coreState) },
      });
      await tables.updateRow({
        databaseId: DB,
        tableId: GAMECARDS,
        rowId: gameCards.$id,
        data: updatedGameCards,
      });

      return {
        success: true,
        skippedJudgeId: state.judgeId,
      };
    } catch (err: any) {
      if (err.statusCode) throw err;
      throw createError({ statusCode: 500, statusMessage: err.message });
    }
  });
});
