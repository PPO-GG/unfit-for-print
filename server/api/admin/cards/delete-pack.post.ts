import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { whiteCards, blackCards, defaultCardPacks, cardPacks } from "~~/server/db/schema";
import { cardTable } from "~~/server/utils/cardTable";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { pack, type = "all" } = await readBody<{ pack: string; type?: string }>(event);

  if (!pack || typeof pack !== "string") {
    throw createError({ statusCode: 400, statusMessage: "pack name is required" });
  }

  const db = useDb();

  // One transaction over both branches: the card deletes and the auxiliary-row
  // cleanup have to stand or fall together. Before card_packs is migrated the
  // last statement throws, and without this the cards would already be gone.
  return db.transaction(async (tx) => {
    if (type === "all") {
      await tx.delete(whiteCards).where(eq(whiteCards.pack, pack));
      await tx.delete(blackCards).where(eq(blackCards.pack, pack));
      await tx.delete(defaultCardPacks).where(eq(defaultCardPacks.pack, pack));
      await tx.delete(cardPacks).where(eq(cardPacks.pack, pack));
      return { success: true };
    }

    const table = cardTable(type);
    await tx.delete(table).where(eq(table.pack, pack));

    // If the opposite card type has no remaining cards in this pack, also clean up defaultCardPacks
    const oppositeTable = type === "white" ? blackCards : whiteCards;
    const remaining = await tx
      .select({ id: oppositeTable.id })
      .from(oppositeTable)
      .where(eq(oppositeTable.pack, pack))
      .limit(1);
    if (!remaining.length) {
      await tx.delete(defaultCardPacks).where(eq(defaultCardPacks.pack, pack));
      await tx.delete(cardPacks).where(eq(cardPacks.pack, pack));
    }

    return { success: true };
  });
});
