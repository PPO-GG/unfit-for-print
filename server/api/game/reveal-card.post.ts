// server/api/game/reveal-card.post.ts
// Reveals a submission card during the judging phase.
// Persists the reveal in gameState so all players see the flip via realtime.
//
// Auth: Session-based. The caller must be:
//   - The judge (human judge revealing cards), OR
//   - The host acting on behalf of a bot judge (host triggers bot reveals)

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, playerId } = body;

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

  // Session-based auth: get the authenticated caller's userId
  const callerId = await requireAuth(event);

  const { DB, LOBBY } = getCollectionIds();
  const tables = getAdminTables();

  return withRetry(async () => {
    const lobby = await tables.getRow({
      databaseId: DB,
      tableId: LOBBY,
      rowId: lobbyId,
    });
    const capturedVersion = lobby.$updatedAt;
    const state = decodeGameState(lobby.gameState);

    // Must be in judging phase
    if (state.phase !== "judging") {
      throw createError({
        statusCode: 400,
        statusMessage: "Not in judging phase",
      });
    }

    // Authorization: caller must be the judge, or the host acting for a bot judge
    const isJudge = state.judgeId === callerId;
    const isHostForBotJudge =
      lobby.hostUserId === callerId && state.judgeId?.startsWith("bot_");

    if (!isJudge && !isHostForBotJudge) {
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
    await tables.updateRow({
      databaseId: DB,
      tableId: LOBBY,
      rowId: lobbyId,
      data: {
        gameState: encodeGameState(coreState),
      },
    });

    return { success: true };
  });
});
