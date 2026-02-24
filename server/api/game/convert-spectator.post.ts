// server/api/game/convert-spectator.post.ts
// Converts a spectator into an active player and deals them a hand of white cards.
// Previously done client-side (security risk — no validation, no authorization).
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

  // Auth: Only the host can convert spectators
  await verifyHost(userId, lobbyId);

  const { DB, LOBBY, PLAYER, GAMECARDS } = getCollectionIds();
  const databases = getAdminDatabases();
  const tables = getAdminTables();

  return withRetry(async () => {
    try {
      // --- Fetch the spectator's player document ---
      const playersRes = await tables.listRows({ databaseId: DB, tableId: PLAYER, queries: [
                  Query.equal("userId", playerId),
                  Query.equal("lobbyId", lobbyId),
                  Query.limit(1),
                ] });

      if (playersRes.total === 0) {
        throw createError({
          statusCode: 404,
          statusMessage: "Player not found in this lobby",
        });
      }

      const playerDoc = playersRes.rows[0]!;

      if (playerDoc.playerType !== "spectator") {
        throw createError({
          statusCode: 400,
          statusMessage: "Player is not a spectator",
        });
      }

      // --- Fetch lobby and validate game is in progress ---
      const lobby = await tables.getRow({ databaseId: DB, tableId: LOBBY, rowId: lobbyId });
      const capturedVersion = lobby.$updatedAt;
      if (lobby.status !== "playing") {
        throw createError({
          statusCode: 400,
          statusMessage: "Game is not currently in progress",
        });
      }

      const state = decodeGameState(lobby.gameState);
      const cardsPerPlayer = state.config?.cardsPerPlayer || 7;

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
      const whiteDeck: string[] = gameCards.whiteDeck || [];

      if (whiteDeck.length < cardsPerPlayer) {
        throw createError({
          statusCode: 400,
          statusMessage: `Not enough cards in deck to deal a hand (need ${cardsPerPlayer}, have ${whiteDeck.length})`,
        });
      }

      // --- Deal cards from the white deck ---
      const newHand = whiteDeck.slice(0, cardsPerPlayer);
      const remainingDeck = whiteDeck.slice(cardsPerPlayer);

      // --- Update player hands ---
      const hands = parsePlayerHands(gameCards.playerHands);
      hands[playerId] = newHand;

      // --- Update game state to include new player's score ---
      if (!state.scores[playerId]) {
        state.scores[playerId] = 0;
      }

      // --- Concurrency check + Persist ---
      // Player type update is safe (no conflict risk)
      await tables.updateRow({ databaseId: DB, tableId: PLAYER, rowId: playerDoc.$id, data: {
                  playerType: "player",
                } });
      // Assert before lobby/gamecards writes
      await assertVersionUnchanged(lobbyId, capturedVersion);
      await tables.updateRow({ databaseId: DB, tableId: GAMECARDS, rowId: gameCards.$id, data: {
                  whiteDeck: remainingDeck,
                  playerHands: serializePlayerHands(hands),
                } });
      await tables.updateRow({ databaseId: DB, tableId: LOBBY, rowId: lobbyId, data: {
                  gameState: encodeGameState(extractCoreState(state)),
                } });

      return {
        success: true,
        playerId,
        cardsDealt: newHand.length,
      };
    } catch (err: any) {
      if (err.statusCode) throw err;
      throw createError({ statusCode: 500, statusMessage: err.message });
    }
  });
});
