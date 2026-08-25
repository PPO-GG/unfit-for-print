// server/api/cards/resolve.post.ts
//
// Batch-resolves white card texts for a given list of card IDs.
// Called by the client to populate a local cardTexts map — eliminating
// the N+1 pattern where every WhiteCard/BlackCard component individually
// fetched its own text.
//
// Missing or invalid IDs are silently omitted from the response.

import { inArray } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { whiteCards } from "~/server/db/schema";

export default defineEventHandler(async (event) => {
  const { ids } = await readBody<{ ids: string[] }>(event);

  if (!Array.isArray(ids)) {
    throw createError({ statusCode: 400, message: "ids must be an array" });
  }
  const deduped = [...new Set(ids)];
  if (deduped.length > 500) {
    throw createError({ statusCode: 400, message: "Too many ids (max 500)" });
  }
  if (deduped.length === 0) return [];

  const db = useDb();
  return db
    .select({ id: whiteCards.id, text: whiteCards.text, pack: whiteCards.pack })
    .from(whiteCards)
    .where(inArray(whiteCards.id, deduped));
});
