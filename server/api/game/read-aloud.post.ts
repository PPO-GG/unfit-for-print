// server/api/game/read-aloud.post.ts
// Sets the `readAloudText` field in the game state so every client
// receives the merged card text via Appwrite realtime and plays it
// through their local TTS provider.
//
// Auth: Session-based. Caller must be the judge (or host for bot judge).

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, text } = body;

  if (!lobbyId)
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });
  if (!text || typeof text !== "string")
    throw createError({
      statusCode: 400,
      statusMessage: "text is required",
    });

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

    // Authorization: caller must be the judge, or the host for a bot judge
    const isJudge = state.judgeId === callerId;
    const isHostForBotJudge =
      lobby.hostUserId === callerId && state.judgeId?.startsWith("bot_");

    if (!isJudge && !isHostForBotJudge) {
      throw createError({
        statusCode: 403,
        statusMessage: "Only the judge can trigger read-aloud",
      });
    }

    // Set the ephemeral read-aloud text
    state.readAloudText = text;

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
