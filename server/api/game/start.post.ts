// server/api/game/start.post.ts
// Replaces the Appwrite Function: functions/startGame/src/main.js
import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, documentId, settings } = body;

  if (!lobbyId) {
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });
  }

  const {
    DB,
    LOBBY,
    PLAYER,
    WHITE_CARDS,
    BLACK_CARDS,
    GAMECARDS,
    GAMESETTINGS,
  } = getCollectionIds();
  const databases = getAdminDatabases();

  try {
    // --- Fetch Game Settings if documentId is provided ---
    let gameSettings = settings || null;
    if (documentId && !gameSettings) {
      try {
        gameSettings = await databases.getDocument(
          DB,
          GAMESETTINGS,
          documentId,
        );
      } catch (err: any) {
        console.error("[startGame] Failed to fetch settings:", err.message);
        throw createError({
          statusCode: 500,
          statusMessage: "Could not load game settings",
        });
      }
    }

    // --- Load lobby + players (filtered to this lobby only) ---
    const lobby = await databases.getDocument(DB, LOBBY, lobbyId);
    const playersRes = await databases.listDocuments(DB, PLAYER, [
      Query.equal("lobbyId", lobbyId),
      Query.notEqual("playerType", "spectator"),
      Query.limit(100),
    ]);
    const playerIds = playersRes.documents.map((d) => d.userId);
    const playerCount = playerIds.length;

    if (playerCount < 2) {
      throw createError({
        statusCode: 400,
        statusMessage: "Not enough players to start",
      });
    }

    // --- Build white-card deck ---
    const allWhiteIds = shuffle(
      await fetchAllIds(WHITE_CARDS, databases, DB, gameSettings?.cardPacks),
    );
    const CARDS_PER_PLAYER = gameSettings?.numPlayerCards || 7;
    const EXTRA_WHITES = 20;
    const totalWhites = playerCount * CARDS_PER_PLAYER + EXTRA_WHITES;

    // Deal hands
    const hands: Record<string, string[]> = {};
    playerIds.forEach((pid, idx) => {
      const start = idx * CARDS_PER_PLAYER;
      hands[pid] = allWhiteIds.slice(start, start + CARDS_PER_PLAYER);
    });

    // Build draw-pile (the extra whites)
    const whiteDeck = allWhiteIds.slice(
      playerCount * CARDS_PER_PLAYER,
      totalWhites,
    );

    // --- Build black-card deck ---
    const allBlackIds = shuffle(
      await fetchAllIds(BLACK_CARDS, databases, DB, gameSettings?.cardPacks),
    );

    if (!Array.isArray(allBlackIds) || allBlackIds.length === 0) {
      throw createError({
        statusCode: 500,
        statusMessage: "No black cards available for selected card packs",
      });
    }

    const INITIAL_BLACK_CARDS = 5;
    const firstBlackId = allBlackIds[0];
    const firstBlack = await databases.getDocument(
      DB,
      BLACK_CARDS,
      firstBlackId,
    );
    const blackDeck = allBlackIds.slice(1, INITIAL_BLACK_CARDS);

    // --- Assemble game state (no card data — stored separately) ---
    const gameState = {
      phase: "submitting",
      judgeId: lobby.hostUserId,
      blackCard: {
        id: firstBlack.$id,
        text: firstBlack.text,
        pick: firstBlack.pick || 1,
      },
      submissions: {},
      playedCards: {},
      scores: playerIds.reduce(
        (acc: Record<string, number>, id: string) => ({ ...acc, [id]: 0 }),
        {},
      ),
      round: 1,
      roundWinner: null,
      roundEndStartTime: null,
      gameEndTime: null,
      returnedToLobby: {},
      config: {
        maxPoints: gameSettings?.maxPoints || 10,
        cardsPerPlayer: CARDS_PER_PLAYER,
        cardPacks: gameSettings?.cardPacks || [],
        isPrivate: gameSettings?.isPrivate || false,
        lobbyName: gameSettings?.lobbyName || "Unnamed Game",
      },
    };

    // --- Create gamecards document ---
    const handsArray = serializePlayerHands(hands);
    const gameCards = {
      lobbyId,
      whiteDeck,
      blackDeck,
      discardWhite: [] as string[],
      discardBlack: [] as string[],
      playerHands: handsArray,
    };

    await databases.createDocument(DB, GAMECARDS, "unique()", gameCards);

    // --- Update lobby status ---
    await databases.updateDocument(DB, LOBBY, lobbyId, {
      status: "playing",
      gameState: encodeGameState(gameState),
    });

    return { success: true };
  } catch (err: any) {
    console.error("[startGame] Error:", err.message);
    // Re-throw H3 errors as-is
    if (err.statusCode) throw err;
    throw createError({ statusCode: 500, statusMessage: err.message });
  }
});
