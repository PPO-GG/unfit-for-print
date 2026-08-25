// server/api/game/draw-cards.post.ts
// Fetches fresh white cards from Postgres, excluding already-used IDs.
// Called mid-game when the draw pile runs low — keeps cards fresh (no recycling).

import { inArray } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { whiteCards } from "~/server/db/schema";
import { fetchAllIds, shuffle } from "~/server/utils/game-engine";
import { requirePlayerInLobby } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  const { lobbyId, cardPacks, excludeIds, count = 200 } = await readBody<{
    lobbyId: string;
    cardPacks?: string[];
    excludeIds: string[];
    count?: number;
  }>(event);

  if (!Array.isArray(excludeIds)) {
    throw createError({ statusCode: 400, statusMessage: "excludeIds must be an array" });
  }
  if (!lobbyId) {
    throw createError({ statusCode: 400, statusMessage: "lobbyId is required" });
  }

  // Auth: caller must be a player in this lobby
  await requirePlayerInLobby(event, lobbyId);

  const db = useDb();

  // Fetch ALL white card IDs for the selected packs
  const allIds = shuffle(await fetchAllIds(whiteCards, cardPacks));

  // Filter out already-used IDs
  const usedSet = new Set(excludeIds);
  const selectedIds = allIds.filter((id) => !usedSet.has(id)).slice(0, count);

  if (selectedIds.length === 0) {
    return { success: true, cardIds: [], cardTexts: {} };
  }

  // Resolve card texts
  const rows = await db
    .select({ id: whiteCards.id, text: whiteCards.text, pack: whiteCards.pack })
    .from(whiteCards)
    .where(inArray(whiteCards.id, selectedIds));

  const cardTexts: Record<string, { text: string; pack: string }> = {};
  for (const row of rows) {
    cardTexts[row.id] = { text: row.text ?? "", pack: row.pack ?? "" };
  }

  return { success: true, cardIds: selectedIds, cardTexts };
});
