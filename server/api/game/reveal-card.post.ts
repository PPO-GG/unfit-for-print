// server/api/game/reveal-card.post.ts
// Reveals a submission card during the judging phase.
// Persists the reveal in gameState so all players see the flip via realtime.

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

  const { DB, LOBBY } = getCollectionIds();
  const databases = getAdminDatabases();

  return withRetry(async () => {
    const lobby = await databases.getDocument(DB, LOBBY, lobbyId);
    const capturedVersion = lobby.$updatedAt;
    const state = decodeGameState(lobby.gameState);

    // Must be in judging phase
    if (state.phase !== "judging") {
      throw createError({
        statusCode: 400,
        statusMessage: "Not in judging phase",
      });
    }

    // Only the judge can reveal cards
    if (state.judgeId !== userId) {
      throw createError({
        statusCode: 403,
        statusMessage: "Only the judge can reveal cards",
      });
    }

    // Already revealed — no-op success
    if (state.revealedCards?.[playerId]) {
      return { success: true, alreadyRevealed: true };
    }

    // Mark the card as revealed
    state.revealedCards = {
      ...(state.revealedCards || {}),
      [playerId]: true,
    };

    const coreState = extractCoreState(state);

    // Concurrency check + persist
    await assertVersionUnchanged(lobbyId, capturedVersion);
    await databases.updateDocument(DB, LOBBY, lobbyId, {
      gameState: encodeGameState(coreState),
    });

    return { success: true };
  });
});
