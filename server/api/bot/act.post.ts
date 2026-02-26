// server/api/bot/act.post.ts
// Executes a game action on behalf of a bot player.
// Supports two actions:
//   - 'play': pick random cards from the bot's hand and submit them
//   - 'judge': pick a random winner from the submissions
//
// Auth: Admin-SDK verified session via requireHost.
// Client must send Authorization + x-appwrite-user-id headers.
import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, botUserId, action } = body;

  if (!lobbyId) {
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });
  }
  if (!botUserId || !botUserId.startsWith("bot_")) {
    throw createError({
      statusCode: 400,
      statusMessage: "botUserId is required and must be a bot",
    });
  }
  if (!action || !["play", "judge"].includes(action)) {
    throw createError({
      statusCode: 400,
      statusMessage: "action must be 'play' or 'judge'",
    });
  }

  // Session-based auth: verify the caller is the authenticated host
  await requireHost(event, lobbyId);

  const { DB, LOBBY, GAMECARDS, PLAYER } = getCollectionIds();
  const databases = getAdminDatabases();
  const tables = getAdminTables();

  // --- Verify the bot exists in this lobby ---
  const botRes = await tables.listRows({
    databaseId: DB,
    tableId: PLAYER,
    queries: [
      Query.equal("userId", botUserId),
      Query.equal("lobbyId", lobbyId),
      Query.equal("playerType", "bot"),
      Query.limit(1),
    ],
  });

  if (botRes.total === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: "Bot not found in this lobby",
    });
  }

  if (action === "play") {
    return await handleBotPlay(
      databases,
      DB,
      LOBBY,
      GAMECARDS,
      lobbyId,
      botUserId,
    );
  }

  if (action === "judge") {
    return await handleBotJudge(
      databases,
      DB,
      LOBBY,
      GAMECARDS,
      lobbyId,
      botUserId,
    );
  }
});

// ─── Bot Play: pick random cards from hand and submit ────────────────────────

async function handleBotPlay(
  databases: any,
  DB: string,
  LOBBY: string,
  GAMECARDS: string,
  lobbyId: string,
  botUserId: string,
) {
  const tables = getAdminTables();
  return withRetry(async () => {
    const lobby = await tables.getRow({
      databaseId: DB,
      tableId: LOBBY,
      rowId: lobbyId,
    });
    const capturedVersion = lobby.$updatedAt;
    const state = decodeGameState(lobby.gameState);

    // Validations
    if (state.phase !== "submitting") {
      return { success: false, reason: "Not in submitting phase" };
    }
    if (state.judgeId === botUserId) {
      return { success: false, reason: "Bot is the judge this round" };
    }
    if (state.submissions?.[botUserId]) {
      return { success: false, reason: "Bot already submitted" };
    }

    // Fetch gamecards
    const gameCardsQuery = await tables.listRows({
      databaseId: DB,
      tableId: GAMECARDS,
      queries: [Query.equal("lobbyId", lobbyId)],
    });
    if (gameCardsQuery.rows.length === 0) {
      return { success: false, reason: "No gamecards found" };
    }
    const gameCards = gameCardsQuery.rows[0]!;

    // Merge hands
    state.hands = parsePlayerHands(gameCards.playerHands);

    const botHand = state.hands[botUserId];
    if (!botHand || botHand.length === 0) {
      return { success: false, reason: "Bot has no cards" };
    }

    // Determine how many cards to play (based on black card pick count)
    const pickCount = state.blackCard?.pick || 1;
    const cardsToPlay = botHand.slice(0, Math.min(pickCount, botHand.length));

    // Remove played cards from hand
    for (const cardId of cardsToPlay) {
      const idx = state.hands[botUserId].indexOf(cardId);
      if (idx >= 0) {
        state.hands[botUserId].splice(idx, 1);
      }
    }

    // Record submission
    state.submissions = state.submissions || {};
    state.submissions[botUserId] = cardsToPlay;

    // Check if all players have submitted
    const skippedPlayers: string[] = state.skippedPlayers || [];
    const toPlay = Object.keys(state.hands).filter(
      (id) => id !== state.judgeId && !skippedPlayers.includes(id),
    );
    if (Object.keys(state.submissions).length === toPlay.length) {
      state.phase = "judging";
    }

    // Persist
    const updatedGameCards = {
      lobbyId: gameCards.lobbyId,
      whiteDeck: gameCards.whiteDeck,
      blackDeck: gameCards.blackDeck,
      discardWhite: gameCards.discardWhite,
      discardBlack: gameCards.discardBlack,
      playerHands: serializePlayerHands(state.hands),
    };

    const coreState = extractCoreState(state);

    await assertVersionUnchanged(lobbyId, capturedVersion);
    // IMPORTANT: Write LOBBY (gameState with submissions) FIRST to minimize
    // the TOCTOU window. The version check protects the lobby document.
    await tables.updateRow({
      databaseId: DB,
      tableId: LOBBY,
      rowId: lobbyId,
      data: {
        gameState: encodeGameState(coreState),
      },
    });
    await tables.updateRow({
      databaseId: DB,
      tableId: GAMECARDS,
      rowId: gameCards.$id,
      data: updatedGameCards,
    });

    // Post-write verification: confirm the bot's submission survived
    await verifySubmission(lobbyId, botUserId);

    return { success: true, cardsPlayed: cardsToPlay };
  });
}

// ─── Bot Judge: pick a random winner from submissions ────────────────────────

async function handleBotJudge(
  databases: any,
  DB: string,
  LOBBY: string,
  GAMECARDS: string,
  lobbyId: string,
  botUserId: string,
) {
  const tables = getAdminTables();
  return withRetry(async () => {
    const lobby = await tables.getRow({
      databaseId: DB,
      tableId: LOBBY,
      rowId: lobbyId,
    });
    const capturedVersion = lobby.$updatedAt;
    const state = decodeGameState(lobby.gameState);

    // Validations
    if (state.phase !== "judging") {
      return { success: false, reason: "Not in judging phase" };
    }
    if (state.judgeId !== botUserId) {
      return { success: false, reason: "Bot is not the judge" };
    }

    // Pick a random winner from submissions
    const submitterIds = Object.keys(state.submissions || {});
    if (submitterIds.length === 0) {
      return { success: false, reason: "No submissions to judge" };
    }

    const randomIndex = Math.floor(Math.random() * submitterIds.length);
    const winnerId = submitterIds[randomIndex]!;

    // Fetch gamecards for discard management
    const gameCardsQuery = await tables.listRows({
      databaseId: DB,
      tableId: GAMECARDS,
      queries: [Query.equal("lobbyId", lobbyId)],
    });
    if (gameCardsQuery.rows.length === 0) {
      return { success: false, reason: "No gamecards found" };
    }
    const gameCards = gameCardsQuery.rows[0]!;

    // Merge discard piles from gameCards
    state.discardWhite = gameCards.discardWhite || [];
    state.discardBlack = gameCards.discardBlack || [];

    // Award point
    state.scores = state.scores || {};
    state.scores[winnerId] = (state.scores[winnerId] || 0) + 1;

    // Store winning cards
    state.winningCards = state.submissions?.[winnerId] || [];

    // Discard played white cards
    Object.values(state.submissions as Record<string, string[]>)
      .flat()
      .forEach((id: string) => state.discardWhite.push(id));

    // Discard black card
    if (state.blackCard?.id) {
      state.discardBlack.push(state.blackCard.id);
    }

    // Clear submissions
    state.submissions = {};

    // Check win condition
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

    // Persist
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
      data: {
        status: state.phase === "complete" ? "complete" : "playing",
        gameState: encodeGameState(coreState),
      },
    });
    await tables.updateRow({
      databaseId: DB,
      tableId: GAMECARDS,
      rowId: gameCards.$id,
      data: updatedGameCards,
    });

    return { success: true, winnerId, phase: state.phase };
  });
}
