import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { whiteCards, blackCards, defaultCardPacks } from "~~/server/db/schema";
import { cardTable } from "~~/server/utils/cardTable";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { pack, type = "all" } = await readBody<{ pack: string; type?: string }>(event);

  if (!pack || typeof pack !== "string") {
    throw createError({ statusCode: 400, statusMessage: "pack name is required" });
  }

  const db = useDb();

  if (type === "all") {
    await Promise.all([
      db.delete(whiteCards).where(eq(whiteCards.pack, pack)),
      db.delete(blackCards).where(eq(blackCards.pack, pack)),
      db.delete(defaultCardPacks).where(eq(defaultCardPacks.pack, pack)),
    ]);
    return { success: true };
  }

  const table = cardTable(type);
  await db.delete(table).where(eq(table.pack, pack));

  // If the opposite card type has no remaining cards in this pack, also clean up defaultCardPacks
  const oppositeTable = type === "white" ? blackCards : whiteCards;
  const remaining = await db.select({ id: oppositeTable.id }).from(oppositeTable).where(eq(oppositeTable.pack, pack)).limit(1);
  if (!remaining.length) {
    await db.delete(defaultCardPacks).where(eq(defaultCardPacks.pack, pack));
  }

  return { success: true };
});
