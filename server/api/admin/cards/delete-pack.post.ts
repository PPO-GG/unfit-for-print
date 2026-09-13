import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { whiteCards, blackCards, cardPacks } from "~~/server/db/schema";
import { cardTable } from "~~/server/utils/cardTable";
import { findPackId, packCardCounts } from "~~/server/utils/packs";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { pack, packId: rawId, type = "all" } = await readBody<{
    pack?: string;
    packId?: string;
    type?: string;
  }>(event);

  const ref = rawId ?? pack;
  if (!ref || typeof ref !== "string") {
    throw createError({ statusCode: 400, statusMessage: "pack is required" });
  }

  const db = useDb();

  // One transaction: the card deletes and the registry-row removal stand or
  // fall together. The row carries the pack's metadata and default flag, so
  // it goes exactly when the pack has no cards left.
  return db.transaction(async (tx) => {
    const packId = await findPackId(tx, ref);
    if (!packId) return { success: true };

    if (type === "all") {
      await tx.delete(whiteCards).where(eq(whiteCards.packId, packId));
      await tx.delete(blackCards).where(eq(blackCards.packId, packId));
    } else {
      const table = cardTable(type);
      await tx.delete(table).where(eq(table.packId, packId));
    }

    const remaining = await packCardCounts(tx, packId);
    if (remaining.white + remaining.black === 0) {
      await tx.delete(cardPacks).where(eq(cardPacks.id, packId));
    }
    return { success: true };
  });
});
