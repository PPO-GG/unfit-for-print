// server/api/game/start.post.ts
// Fetches and shuffles cards from Appwrite, returns the data as JSON
// for the client to write into the Y.Doc.
import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, documentId, settings, userId } = body;

  if (!lobbyId) {
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });
  }

  // Auth: Only the lobby host can start the game
  await verifyHost(userId, lobbyId);

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
  const tables = getAdminTables();

  try {
    // --- Fetch Game Settings if documentId is provided ---
    let gameSettings = settings || null;
    if (documentId && !gameSettings) {
      try {
        gameSettings = await tables.getRow({
          databaseId: DB,
          tableId: GAMESETTINGS,
          rowId: documentId,
        });
      } catch (err: any) {
        console.error("[startGame] Failed to fetch settings:", err.message);
        throw createError({
          statusCode: 500,
          statusMessage: "Could not load game settings",
        });
      }
    }

    // --- Load lobby + players (filtered to this lobby only) ---
    const lobby = await tables.getRow({
      databaseId: DB,
      tableId: LOBBY,
      rowId: lobbyId,
    });
    const playersRes = await tables.listRows({
      databaseId: DB,
      tableId: PLAYER,
      queries: [
        Query.equal("lobbyId", lobbyId),
        Query.notEqual("playerType", "spectator"),
        Query.limit(100),
      ],
    });
    const playerIds = playersRes.rows.map((d) => d.userId);
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
    const EXTRA_WHITES = 100;
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

    const firstBlackId = allBlackIds[0] as string;
    const firstBlack = await tables.getRow({
      databaseId: DB,
      tableId: BLACK_CARDS,
      rowId: firstBlackId,
    });
    const blackDeck = allBlackIds.slice(1);

    // --- Batch-resolve all card texts for embedding in Y.Doc ---
    // This eliminates the N+1 pattern — all card texts are resolved server-side
    // and sent to the client to embed in the Y.Doc once.
    const BATCH_SIZE = 100;
    const cardTexts: Record<
      string,
      { text: string; pack: string; pick?: number }
    > = {};

    // Resolve white card texts
    const allWhiteIdsToResolve = [
      ...new Set([...Object.values(hands).flat(), ...whiteDeck]),
    ];
    for (let i = 0; i < allWhiteIdsToResolve.length; i += BATCH_SIZE) {
      const batch = allWhiteIdsToResolve.slice(i, i + BATCH_SIZE);
      try {
        const res = await tables.listRows({
          databaseId: DB,
          tableId: WHITE_CARDS,
          queries: [
            Query.equal("$id", batch),
            Query.limit(BATCH_SIZE),
            Query.select(["$id", "text", "pack"]),
          ],
        });
        for (const doc of res.rows) {
          cardTexts[doc.$id] = {
            text: (doc as any).text ?? "",
            pack: (doc as any).pack ?? "",
          };
        }
      } catch (err) {
        console.error("[startGame] White card batch resolve failed:", err);
      }
    }

    // Resolve ALL black card texts (including pick count for multi-pick prompts)
    const allBlackIdsToResolve = [firstBlackId, ...blackDeck];
    for (let i = 0; i < allBlackIdsToResolve.length; i += BATCH_SIZE) {
      const batch = allBlackIdsToResolve.slice(i, i + BATCH_SIZE);
      try {
        const res = await tables.listRows({
          databaseId: DB,
          tableId: BLACK_CARDS,
          queries: [
            Query.equal("$id", batch),
            Query.limit(BATCH_SIZE),
            Query.select(["$id", "text", "pack", "pick"]),
          ],
        });
        for (const doc of res.rows) {
          cardTexts[doc.$id] = {
            text: (doc as any).text ?? "",
            pack: (doc as any).pack ?? "",
            pick: (doc as any).pick ?? 1,
          };
        }
      } catch (err) {
        console.error("[startGame] Black card batch resolve failed:", err);
      }
    }

    // --- Update Appwrite lobby status (registry only) ---
    await tables.updateRow({
      databaseId: DB,
      tableId: LOBBY,
      rowId: lobbyId,
      data: {
        status: "playing",
      },
    });

    // --- Return card data for client to write into Y.Doc ---
    return {
      success: true,
      whiteDeck,
      blackDeck,
      blackCard: {
        id: firstBlack.$id,
        text: firstBlack.text,
        pick: firstBlack.pick || 1,
      },
      hands,
      cardTexts,
      playerOrder: playerIds,
      judgeId: lobby.hostUserId,
      config: {
        maxPoints: gameSettings?.maxPoints || 10,
        cardsPerPlayer: CARDS_PER_PLAYER,
        cardPacks: gameSettings?.cardPacks || [],
        isPrivate: gameSettings?.isPrivate || false,
        lobbyName: gameSettings?.lobbyName || "Unnamed Game",
      },
    };
  } catch (err: any) {
    console.error("[startGame] Error:", err.message);
    // Re-throw H3 errors as-is
    if (err.statusCode) throw err;
    throw createError({ statusCode: 500, statusMessage: err.message });
  }
});
