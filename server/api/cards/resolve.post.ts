// server/api/cards/resolve.post.ts
//
// Batch-resolves card texts for a given list of card IDs. Defaults to white
// cards (the original/still-most-common contract — all existing callers
// keep working unchanged); pass `type: "black"` to resolve black cards
// instead, which also returns `pick`.
//
// Called by the client to populate a local cardTexts map — eliminating
// the N+1 pattern where every WhiteCard/BlackCard component individually
// fetched its own text.
//
// Missing or invalid IDs are silently omitted from the response.
//
// `packDisplayName`/`packSeries` ride along so the card footer can render a
// pack the way every other surface does (see app/utils/packName.ts). They have
// to come from here rather than a roster lookup: a single card knows only its
// own pack string, with no set of sibling packs to derive a series prefix
// from. The join is LEFT — most packs have no card_packs row at all, and an
// inner join would empty most players' hands.

import { eq, inArray } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { blackCards, cardPacks, whiteCards } from "~~/server/db/schema";

export default defineEventHandler(async (event) => {
  const { ids, type = "white" } = await readBody<{
    ids: string[];
    type?: "white" | "black";
  }>(event);

  if (!Array.isArray(ids)) {
    throw createError({ statusCode: 400, message: "ids must be an array" });
  }
  const deduped = [...new Set(ids)];
  if (deduped.length > 500) {
    throw createError({ statusCode: 400, message: "Too many ids (max 500)" });
  }
  if (deduped.length === 0) return [];

  const db = useDb();

  if (type === "black") {
    return db
      .select({
        id: blackCards.id,
        text: blackCards.text,
        pack: blackCards.pack,
        packDisplayName: cardPacks.displayName,
        packSeries: cardPacks.series,
        pick: blackCards.pick,
        imageKey: blackCards.imageKey,
        imageFormat: blackCards.imageFormat,
        attachment: blackCards.attachment,
      })
      .from(blackCards)
      .leftJoin(cardPacks, eq(blackCards.pack, cardPacks.pack))
      .where(inArray(blackCards.id, deduped));
  }

  return db
    .select({
      id: whiteCards.id,
      text: whiteCards.text,
      pack: whiteCards.pack,
      packDisplayName: cardPacks.displayName,
      packSeries: cardPacks.series,
      imageKey: whiteCards.imageKey,
      imageFormat: whiteCards.imageFormat,
      attachment: whiteCards.attachment,
    })
    .from(whiteCards)
    .leftJoin(cardPacks, eq(whiteCards.pack, cardPacks.pack))
    .where(inArray(whiteCards.id, deduped));
});
