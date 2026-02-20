// server/api/game/next-round.post.ts
// Replaces the Appwrite Function: functions/startNextRound/src/main.js
import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, documentId } = body;

  if (!lobbyId)
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });

  // Auth: Caller must be a player in this lobby
  await requirePlayerInLobby(event, lobbyId);

  const { DB, LOBBY, WHITE_CARDS, BLACK_CARDS, GAMECARDS, GAMESETTINGS } =
    getCollectionIds();
  const databases = getAdminDatabases();

  return withRetry(async () => {
    try {
      // --- Fetch Game Settings if documentId is provided ---
      let settings: Record<string, any> | null = null;
      if (documentId) {
        try {
          settings = await databases.getDocument(DB, GAMESETTINGS, documentId);
        } catch {
          console.warn(
            "[nextRound] Could not fetch settings by documentId, continuing without",
          );
        }
      }

      // --- Fetch Lobby and Decode State ---
      const lobby = await databases.getDocument(DB, LOBBY, lobbyId);
      const capturedVersion = lobby.$updatedAt;
      const state = decodeGameState(lobby.gameState);
      const countdownDuration =
        ((lobby as any).roundEndCountdownDuration || 5) * 1000;

      // --- Fetch GameCards document ---
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

      // --- Merge card data from gameCards into state ---
      state.whiteDeck = gameCards.whiteDeck || [];
      state.blackDeck = gameCards.blackDeck || [];
      state.discardWhite = gameCards.discardWhite || [];
      state.discardBlack = gameCards.discardBlack || [];
      state.hands = parsePlayerHands(gameCards.playerHands);

      // --- Validations ---
      if (state.phase !== "roundEnd") {
        return { success: false, message: "Not in roundEnd phase" };
      }

      // Optional time validation (80% of countdown must have elapsed)
      if (state.roundEndStartTime) {
        const timeElapsed = Date.now() - state.roundEndStartTime;
        if (timeElapsed < countdownDuration * 0.8) {
          return { success: false, message: "Countdown not finished" };
        }
      }

      // --- Next Round Setup ---
      state.phase = "submitting";
      state.round += 1;
      state.roundWinner = null;
      state.winningCards = null;
      state.roundEndStartTime = null;
      state.skippedPlayers = [];

      // --- Rotate judge ---
      const playerIds = Object.keys(state.hands || {});
      if (playerIds.length > 0) {
        const currentJudgeIndex = playerIds.indexOf(state.judgeId);
        const nextJudgeIndex =
          currentJudgeIndex === -1 || currentJudgeIndex >= playerIds.length - 1
            ? 0
            : currentJudgeIndex + 1;
        state.judgeId = playerIds[nextJudgeIndex];
      } else {
        state.judgeId = null;
      }

      // --- Card Management: Black Deck ---
      // Note: black card was already discarded in select-winner,
      // so we do NOT push it again here.

      // Refill black deck if needed
      const MIN_BLACK_CARDS = 5;
      if (!state.blackDeck || state.blackDeck.length < MIN_BLACK_CARDS) {
        try {
          const allBlackIds = await fetchAllIds(
            BLACK_CARDS,
            databases,
            DB,
            state.config?.cardPacks,
          );
          const cardsInUse = buildExclusionSet(
            state.discardBlack,
            state.blackDeck,
            state.blackCard?.id ? [state.blackCard.id] : undefined,
          );

          const availableBlackIds = allBlackIds.filter(
            (id) => !cardsInUse.has(id),
          );

          if (availableBlackIds.length > 0) {
            const MAX_BLACK_CARDS = 50;
            const newCards = shuffle(availableBlackIds).slice(
              0,
              MAX_BLACK_CARDS,
            );
            state.blackDeck = [...(state.blackDeck || []), ...newCards];
          } else if (state.discardBlack.length > 0) {
            // Recycle from discard
            state.blackDeck = [
              ...(state.blackDeck || []),
              ...shuffle([...state.discardBlack]),
            ];
            state.discardBlack = [];
          }
        } catch (fetchError: any) {
          console.error(
            "[nextRound] Failed to fetch black cards:",
            fetchError.message,
          );
          // Fallback to discard pile
          if (state.discardBlack?.length > 0) {
            state.blackDeck = [
              ...(state.blackDeck || []),
              ...shuffle([...state.discardBlack]),
            ];
            state.discardBlack = [];
          }
        }
      }

      // Draw next black card
      if (state.blackDeck && state.blackDeck.length > 0) {
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
          console.error("[nextRound] Failed to fetch black card:", nextBlackId);
          state.blackCard = null;
        }
      } else {
        state.blackCard = null;
      }

      // --- Card Management: White Deck ---
      const CARDS_PER_PLAYER =
        settings?.numPlayerCards || state.config?.cardsPerPlayer || 7;
      const requiredWhiteCards = playerIds.length * CARDS_PER_PLAYER;

      if (!state.whiteDeck || state.whiteDeck.length < requiredWhiteCards) {
        try {
          const allWhiteIds = await fetchAllIds(
            WHITE_CARDS,
            databases,
            DB,
            state.config?.cardPacks,
          );

          // Collect cards already in use
          const handsCards = Object.values(
            state.hands || {},
          ).flat() as string[];
          const cardsInUse = buildExclusionSet(
            state.discardWhite,
            state.whiteDeck,
            handsCards,
          );

          const availableWhiteIds = allWhiteIds.filter(
            (id) => !cardsInUse.has(id),
          );

          if (availableWhiteIds.length > 0) {
            const MAX_WHITE_CARDS = 100;
            const newCards = shuffle(availableWhiteIds).slice(
              0,
              MAX_WHITE_CARDS,
            );
            state.whiteDeck = [...(state.whiteDeck || []), ...newCards];
          } else if ((state.discardWhite || []).length > 0) {
            // Recycle from discard
            state.whiteDeck = shuffle([
              ...(state.whiteDeck || []),
              ...state.discardWhite,
            ]);
            state.discardWhite = [];
          }
        } catch (fetchError: any) {
          console.error(
            "[nextRound] Failed to fetch white cards:",
            fetchError.message,
          );
          if ((state.discardWhite || []).length > 0) {
            state.whiteDeck = shuffle([
              ...(state.whiteDeck || []),
              ...state.discardWhite,
            ]);
            state.discardWhite = [];
          }
        }
      }

      // --- Refill player hands ---
      state.hands = state.hands || {};
      for (const pid of playerIds) {
        state.hands[pid] = state.hands[pid] || [];
        const cardsNeeded = CARDS_PER_PLAYER - state.hands[pid].length;
        if (cardsNeeded > 0 && state.whiteDeck && state.whiteDeck.length > 0) {
          const cardsToDeal = state.whiteDeck.splice(
            0,
            Math.min(cardsNeeded, state.whiteDeck.length),
          );
          state.hands[pid].push(...cardsToDeal);
        }
      }

      // --- Reset submissions ---
      state.submissions = {};

      // --- Prepare updated documents ---
      const updatedGameCards = {
        whiteDeck: state.whiteDeck || [],
        blackDeck: state.blackDeck || [],
        discardWhite: state.discardWhite || [],
        discardBlack: state.discardBlack || [],
        playerHands: serializePlayerHands(state.hands),
        lobbyId,
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
