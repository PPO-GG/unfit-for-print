// server/api/game/draw-cards.post.ts
// Fetches fresh white cards from Appwrite, excluding already-used IDs.
// Called mid-game when the draw pile runs low — keeps cards fresh (no recycling).

import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { cardPacks, excludeIds, count = 200 } = body;

  if (!Array.isArray(excludeIds)) {
    throw createError({
      statusCode: 400,
      statusMessage: "excludeIds must be an array",
    });
  }

  const { DB, WHITE_CARDS } = getCollectionIds();
  const tables = getAdminTables();

  try {
    // Fetch ALL white card IDs for the selected packs
    const databases = getAdminDatabases();
    const allIds = shuffle(
      await fetchAllIds(WHITE_CARDS, databases, DB, cardPacks || null),
    );

    // Filter out already-used IDs
    const usedSet = new Set(excludeIds);
    const freshIds = allIds.filter((id) => !usedSet.has(id));

    // Take only what was requested
    const selectedIds = freshIds.slice(0, count);

    if (selectedIds.length === 0) {
      return { success: true, cardIds: [], cardTexts: {} };
    }

    // Batch-resolve card texts
    const BATCH_SIZE = 100;
    const cardTexts: Record<string, { text: string; pack: string }> = {};

    for (let i = 0; i < selectedIds.length; i += BATCH_SIZE) {
      const batch = selectedIds.slice(i, i + BATCH_SIZE);
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
        console.error("[draw-cards] Batch resolve failed:", err);
      }
    }

    return {
      success: true,
      cardIds: selectedIds,
      cardTexts,
    };
  } catch (err: any) {
    console.error("[draw-cards] Error:", err.message);
    if (err.statusCode) throw err;
    throw createError({ statusCode: 500, statusMessage: err.message });
  }
});
