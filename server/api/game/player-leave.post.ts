// server/api/game/player-leave.post.ts
// Handles game state cleanup when a player leaves mid-game.
// Ensures the game advances correctly if the departing player
// was blocking progress (e.g. they hadn't submitted, or they were the judge).
import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, leavingUserId } = body;

  if (!lobbyId)
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });
  if (!leavingUserId)
    throw createError({
      statusCode: 400,
      statusMessage: "leavingUserId is required",
    });

  // Auth: Caller must be a player in this lobby
  await requirePlayerInLobby(event, lobbyId);

  const { DB, LOBBY, PLAYER, GAMECARDS, BLACK_CARDS } = getCollectionIds();
  const databases = getAdminDatabases();

  return withRetry(async () => {
    try {
      // --- Fetch lobby and decode state ---
      const lobby = await databases.getDocument(DB, LOBBY, lobbyId);
      const capturedVersion = lobby.$updatedAt;

      // Only process if game is actively being played
      if (lobby.status !== "playing") {
        return {
          success: true,
          action: "none",
          reason: "Game is not in progress",
        };
      }

      const state = decodeGameState(lobby.gameState);

      // --- Fetch gamecards document ---
      const gameCardsQuery = await databases.listDocuments(DB, GAMECARDS, [
        Query.equal("lobbyId", lobbyId),
      ]);
      if (gameCardsQuery.documents.length === 0) {
        return {
          success: true,
          action: "none",
          reason: "No gamecards document",
        };
      }
      const gameCards = gameCardsQuery.documents[0]!;

      // Merge hands from gamecards
      state.hands = parsePlayerHands(gameCards.playerHands);

      // --- Fetch remaining players (excluding the one leaving) ---
      const playersRes = await databases.listDocuments(DB, PLAYER, [
        Query.equal("lobbyId", lobbyId),
        Query.notEqual("playerType", "spectator"),
        Query.limit(100),
      ]);
      const remainingPlayerIds = playersRes.documents
        .map((d) => d.userId)
        .filter((id) => id !== leavingUserId);

      // --- Remove leaving player from game state ---
      delete state.hands[leavingUserId];
      delete state.submissions[leavingUserId];
      // Remove from skippedPlayers if present
      if (Array.isArray(state.skippedPlayers)) {
        state.skippedPlayers = state.skippedPlayers.filter(
          (id: string) => id !== leavingUserId,
        );
      }
      // Note: we keep their score in state.scores for historical display

      // --- Check if fewer than 3 players remain → revert to waiting ---
      if (remainingPlayerIds.length < 3) {
        state.phase = "waiting";

        const updatedGameCards = {
          lobbyId: gameCards.lobbyId,
          whiteDeck: gameCards.whiteDeck,
          blackDeck: gameCards.blackDeck,
          discardWhite: gameCards.discardWhite,
          discardBlack: gameCards.discardBlack,
          playerHands: serializePlayerHands(state.hands),
        };

        await assertVersionUnchanged(lobbyId, capturedVersion);
        await databases.updateDocument(
          DB,
          GAMECARDS,
          gameCards.$id,
          updatedGameCards,
        );
        await databases.updateDocument(DB, LOBBY, lobbyId, {
          status: "waiting",
          gameState: encodeGameState(extractCoreState(state)),
        });

        return {
          success: true,
          action: "reverted_to_waiting",
          reason: "Fewer than 3 players remain",
        };
      }

      // --- Case 1: Judge left → skip the round and rotate judge ---
      if (leavingUserId === state.judgeId) {
        return await handleJudgeLeft(
          databases,
          DB,
          LOBBY,
          GAMECARDS,
          BLACK_CARDS,
          lobbyId,
          gameCards,
          state,
          remainingPlayerIds,
          leavingUserId,
          capturedVersion,
        );
      }

      // --- Case 2: Non-judge left during submission phase ---
      if (state.phase === "submitting") {
        return await handleSubmitterLeft(
          databases,
          DB,
          LOBBY,
          GAMECARDS,
          lobbyId,
          gameCards,
          state,
          capturedVersion,
        );
      }

      // --- Case 3: Non-judge left during judging phase ---
      // The judge can still pick from remaining submissions. Just persist cleanup.
      if (state.phase === "judging") {
        const updatedGameCards = {
          lobbyId: gameCards.lobbyId,
          whiteDeck: gameCards.whiteDeck,
          blackDeck: gameCards.blackDeck,
          discardWhite: gameCards.discardWhite,
          discardBlack: gameCards.discardBlack,
          playerHands: serializePlayerHands(state.hands),
        };

        await assertVersionUnchanged(lobbyId, capturedVersion);
        await databases.updateDocument(
          DB,
          GAMECARDS,
          gameCards.$id,
          updatedGameCards,
        );
        await databases.updateDocument(DB, LOBBY, lobbyId, {
          gameState: encodeGameState(extractCoreState(state)),
        });

        return {
          success: true,
          action: "cleaned_up",
          reason: "Player removed from judging phase, judge can still choose",
        };
      }

      // --- Default: just persist the cleanup ---
      const updatedGameCards = {
        lobbyId: gameCards.lobbyId,
        whiteDeck: gameCards.whiteDeck,
        blackDeck: gameCards.blackDeck,
        discardWhite: gameCards.discardWhite,
        discardBlack: gameCards.discardBlack,
        playerHands: serializePlayerHands(state.hands),
      };

      await assertVersionUnchanged(lobbyId, capturedVersion);
      await databases.updateDocument(
        DB,
        GAMECARDS,
        gameCards.$id,
        updatedGameCards,
      );
      await databases.updateDocument(DB, LOBBY, lobbyId, {
        gameState: encodeGameState(extractCoreState(state)),
      });

      return { success: true, action: "cleaned_up" };
    } catch (err: any) {
      if (err.statusCode) throw err;
      throw createError({ statusCode: 500, statusMessage: err.message });
    }
  });
});

// ─── Helper: Judge Left ─────────────────────────────────────────────
// When the judge leaves, we skip the current round entirely:
// - Discard the current black card
// - Return all submitted white cards to the discard pile
// - Reset submissions
// - Rotate to the next judge in line
// - Draw a new black card
// - Refill player hands
// - Set phase to "submitting"
async function handleJudgeLeft(
  databases: any,
  DB: string,
  LOBBY: string,
  GAMECARDS: string,
  BLACK_CARDS: string,
  lobbyId: string,
  gameCards: any,
  state: Record<string, any>,
  remainingPlayerIds: string[],
  leavingJudgeId: string,
  capturedVersion: string,
) {
  // Merge card data from gameCards into state for manipulation
  state.whiteDeck = gameCards.whiteDeck || [];
  state.blackDeck = gameCards.blackDeck || [];
  state.discardWhite = gameCards.discardWhite || [];
  state.discardBlack = gameCards.discardBlack || [];

  // Discard the current black card
  if (state.blackCard?.id) {
    state.discardBlack.push(state.blackCard.id);
  }

  // Discard all submitted white cards
  if (state.submissions) {
    for (const cards of Object.values(
      state.submissions as Record<string, string[]>,
    )) {
      state.discardWhite.push(...cards);
    }
  }

  // Reset submissions and skippedPlayers for the new round
  state.submissions = {};
  state.skippedPlayers = [];

  // Rotate judge to the next player in the remaining list
  // Use the same rotation logic as next-round: find the old judge's position
  // among hands keys and pick the next one
  const handPlayerIds = Object.keys(state.hands);
  if (handPlayerIds.length > 0) {
    // The old judge has been removed from hands already, so just pick the first
    // player in the remaining hands. But to maintain order, we find who would
    // have been next after the leaving judge.
    // Since the judge's entry was deleted, we need to figure out order from
    // remainingPlayerIds (which preserves insertion order from the players collection).
    const oldJudgeIdx = remainingPlayerIds.indexOf(leavingJudgeId);
    // leavingJudgeId won't be in remainingPlayerIds, so use handPlayerIds ordering
    // Pick the first available player from hands
    state.judgeId = handPlayerIds[0] || remainingPlayerIds[0];
  } else {
    state.judgeId = remainingPlayerIds[0];
  }

  // Refill hands for players who submitted cards this round
  const CARDS_PER_PLAYER = state.config?.cardsPerPlayer || 7;
  for (const pid of Object.keys(state.hands)) {
    const hand = state.hands[pid] || [];
    const cardsNeeded = CARDS_PER_PLAYER - hand.length;
    if (cardsNeeded > 0 && state.whiteDeck.length > 0) {
      const cardsToDeal = state.whiteDeck.splice(
        0,
        Math.min(cardsNeeded, state.whiteDeck.length),
      );
      hand.push(...cardsToDeal);
      state.hands[pid] = hand;
    }
  }

  // Draw a new black card
  if (state.blackDeck.length > 0) {
    const nextBlackId = state.blackDeck.shift();
    try {
      const blackDoc = await databases.getDocument(
        DB,
        BLACK_CARDS,
        nextBlackId,
      );
      state.blackCard = {
        id: nextBlackId,
        text: blackDoc.text,
        pick: blackDoc.pick || 1,
      };
    } catch {
      console.error("[playerLeave] Failed to fetch black card:", nextBlackId);
      state.blackCard = null;
    }
  } else {
    state.blackCard = null;
  }

  // Set phase back to submitting for the new round
  state.phase = "submitting";
  // Don't increment the round number — this is a skipped round, not a completed one

  // --- Persist ---
  const updatedGameCards = {
    lobbyId,
    whiteDeck: state.whiteDeck,
    blackDeck: state.blackDeck,
    discardWhite: state.discardWhite,
    discardBlack: state.discardBlack,
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

  return {
    success: true,
    action: "judge_left_round_skipped",
    reason:
      "Judge left — round skipped, new judge selected, new black card drawn",
    newJudgeId: state.judgeId,
  };
}

// ─── Helper: Submitter Left During Submission Phase ──────────────────
// Check if all remaining non-judge players have now submitted.
// If so, advance to judging phase.
async function handleSubmitterLeft(
  databases: any,
  DB: string,
  LOBBY: string,
  GAMECARDS: string,
  lobbyId: string,
  gameCards: any,
  state: Record<string, any>,
  capturedVersion: string,
) {
  // Count players who still need to submit (non-judge, non-skipped players)
  const skippedPlayers: string[] = state.skippedPlayers || [];
  const playersWhoMustSubmit = Object.keys(state.hands).filter(
    (id) => id !== state.judgeId && !skippedPlayers.includes(id),
  );
  const submittedCount = Object.keys(state.submissions).length;

  let action = "cleaned_up";
  let reason = "Player removed from submission phase";

  // If all remaining non-judge players have submitted, advance to judging
  if (
    submittedCount >= playersWhoMustSubmit.length &&
    playersWhoMustSubmit.length > 0
  ) {
    state.phase = "judging";
    action = "advanced_to_judging";
    reason = "All remaining players have submitted — advancing to judging";
  }

  // --- Persist ---
  const updatedGameCards = {
    lobbyId: gameCards.lobbyId,
    whiteDeck: gameCards.whiteDeck,
    blackDeck: gameCards.blackDeck,
    discardWhite: gameCards.discardWhite,
    discardBlack: gameCards.discardBlack,
    playerHands: serializePlayerHands(state.hands),
  };

  // --- Concurrency check + Persist ---
  await assertVersionUnchanged(lobbyId, capturedVersion);
  await databases.updateDocument(
    DB,
    GAMECARDS,
    gameCards.$id,
    updatedGameCards,
  );
  await databases.updateDocument(DB, LOBBY, lobbyId, {
    gameState: encodeGameState(extractCoreState(state)),
  });

  return { success: true, action, reason };
}
