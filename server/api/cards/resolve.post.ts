// server/api/cards/resolve.post.ts
//
// Batch-resolves white card texts for a given list of card IDs.
// Called by the client once after fetching gamecards to populate a local
// cardTexts map — eliminating the N+1 pattern where every WhiteCard
// component individually fetched its own text from Appwrite.
//
// Returns: Record<cardId, { text: string; pack: string }>
// Missing or invalid IDs are silently omitted from the response.

import { Query } from "node-appwrite";

const BATCH_SIZE = 100;

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { cardIds } = body as { cardIds: string[] };

  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    return {};
  }

  // Deduplicate and limit to a safe ceiling
  const unique = [...new Set(cardIds)].slice(0, 500);

  const { DB, WHITE_CARDS } = getCollectionIds();
  const databases = getAdminDatabases();
  const tables = getAdminTables();

  const result: Record<string, { text: string; pack: string }> = {};

  // Fetch in batches of BATCH_SIZE using Query.equal on $id
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    try {
      const res = await tables.listRows({ databaseId: DB, tableId: WHITE_CARDS, queries: [
                  Query.equal("$id", batch),
                  Query.limit(BATCH_SIZE),
                  Query.select(["$id", "text", "pack"]),
                ] });
      for (const doc of res.rows) {
        result[doc.$id] = {
          text: (doc as any).text ?? "",
          pack: (doc as any).pack ?? "",
        };
      }
    } catch (err) {
      console.error("[cards/resolve] batch fetch failed:", err);
      // Continue — partial results are better than a total failure
    }
  }

  return result;
});
