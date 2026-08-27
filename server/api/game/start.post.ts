// server/api/game/start.post.ts
// Fetches and shuffles cards from Postgres, returns the data as JSON
// for the client to write into the Y.Doc.
import { eq, and, ne, inArray } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies, players, whiteCards, blackCards } from "~~/server/db/schema";
import { fetchAllIds, shuffle } from "~~/server/utils/game-engine";
import { requireHost } from "~~/server/utils/session";

interface GameSettings {
  cardPacks?: string[];
  numPlayerCards?: number;
  maxPoints?: number;
  maxPick?: number;
  isPrivate?: boolean;
  lobbyName?: string;
}

export default defineEventHandler(async (event) => {
  const { lobbyId, settings } = await readBody<{
    lobbyId: string;
    settings?: GameSettings;
  }>(event);

  if (!lobbyId) {
    throw createError({ statusCode: 400, statusMessage: "lobbyId is required" });
  }

  // Auth: Only the lobby host can start the game (session-verified)
  await requireHost(event, lobbyId);
  const db = useDb();
  const gameSettings = settings ?? null;

  // --- Load lobby + players (filtered to this lobby only) ---
  const [lobby] = await db.select().from(lobbies).where(eq(lobbies.id, lobbyId)).limit(1);
  if (!lobby) throw createError({ statusCode: 404, statusMessage: "Lobby not found" });

  const activePlayers = await db
    .select()
    .from(players)
    .where(and(eq(players.lobbyId, lobbyId), ne(players.playerType, "spectator")))
    .limit(100);
  const playerIds = activePlayers.map((p) => p.userId);
  const playerCount = playerIds.length;

  if (playerCount < 2) {
    throw createError({ statusCode: 400, statusMessage: "Not enough players to start" });
  }

  // --- Build white-card deck ---
  const allWhiteIds = shuffle(await fetchAllIds(whiteCards, gameSettings?.cardPacks));
  const CARDS_PER_PLAYER = gameSettings?.numPlayerCards || 10;
  const EXTRA_WHITES = 300;
  const totalWhites = playerCount * CARDS_PER_PLAYER + EXTRA_WHITES;

  // Deal hands
  const hands: Record<string, string[]> = {};
  playerIds.forEach((pid, idx) => {
    const start = idx * CARDS_PER_PLAYER;
    hands[pid] = allWhiteIds.slice(start, start + CARDS_PER_PLAYER);
  });

  // Build draw-pile (the extra whites)
  const whiteDeck = allWhiteIds.slice(playerCount * CARDS_PER_PLAYER, totalWhites);

  // --- Build black-card deck ---
  const allBlackIds = shuffle(await fetchAllIds(blackCards, gameSettings?.cardPacks));
  if (allBlackIds.length === 0) {
    throw createError({
      statusCode: 500,
      statusMessage: "No black cards available for selected card packs",
    });
  }

  // --- Batch-resolve all card texts for embedding in Y.Doc ---
  // This eliminates the N+1 pattern — all card texts are resolved server-side
  // and sent to the client to embed in the Y.Doc once.
  const cardTexts: Record<string, { text: string; pack: string; pick?: number }> = {};

  // Resolve white card texts
  const allWhiteIdsToResolve = [...new Set([...Object.values(hands).flat(), ...whiteDeck])];
  if (allWhiteIdsToResolve.length > 0) {
    const rows = await db
      .select({ id: whiteCards.id, text: whiteCards.text, pack: whiteCards.pack })
      .from(whiteCards)
      .where(inArray(whiteCards.id, allWhiteIdsToResolve));
    for (const row of rows) {
      cardTexts[row.id] = { text: row.text ?? "", pack: row.pack ?? "" };
    }
  }

  // Resolve ALL black card texts (including pick count for multi-pick prompts)
  const blackRows = await db
    .select({ id: blackCards.id, text: blackCards.text, pack: blackCards.pack, pick: blackCards.pick })
    .from(blackCards)
    .where(inArray(blackCards.id, allBlackIds));
  for (const row of blackRows) {
    cardTexts[row.id] = { text: row.text ?? "", pack: row.pack ?? "", pick: row.pick ?? 1 };
  }

  // --- Apply maxPick filter to black cards ---
  // Remove black cards whose pick count exceeds the host's maxPick setting.
  const MAX_PICK = Math.min(3, Math.max(1, gameSettings?.maxPick ?? 3));
  const eligibleBlackIds = allBlackIds.filter((id) => (cardTexts[id]?.pick ?? 1) <= MAX_PICK);
  if (eligibleBlackIds.length === 0) {
    throw createError({
      statusCode: 500,
      statusMessage: `No black cards available with pick <= ${MAX_PICK} for selected card packs`,
    });
  }

  const firstBlackId = eligibleBlackIds[0]!;
  const firstBlack = cardTexts[firstBlackId]!;
  const blackDeck = eligibleBlackIds.slice(1);

  // --- Update lobby status ---
  await db.update(lobbies).set({ status: "playing" }).where(eq(lobbies.id, lobbyId));

  // --- Return card data for client to write into Y.Doc ---
  return {
    success: true,
    whiteDeck,
    blackDeck,
    blackCard: { id: firstBlackId, text: firstBlack.text, pick: firstBlack.pick || 1, pack: firstBlack.pack ?? "" },
    hands,
    cardTexts,
    playerOrder: playerIds,
    judgeId: lobby.hostUserId,
    config: {
      maxPoints: gameSettings?.maxPoints || 10,
      cardsPerPlayer: CARDS_PER_PLAYER,
      maxPick: MAX_PICK,
      cardPacks: gameSettings?.cardPacks || [],
      isPrivate: gameSettings?.isPrivate || false,
      lobbyName: gameSettings?.lobbyName || "Unnamed Game",
    },
  };
});
