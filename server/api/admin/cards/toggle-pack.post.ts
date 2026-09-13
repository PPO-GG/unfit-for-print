import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { whiteCards, blackCards } from "~~/server/db/schema";
import { cardTable } from "~~/server/utils/cardTable";
import { findPackId } from "~~/server/utils/packs";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { pack, packId: rawId, type, active } = await readBody<{
    pack?: string;
    packId?: string;
    type: string;
    active: boolean;
  }>(event);
  const db = useDb();

  const packId = await findPackId(db, rawId ?? pack);
  if (!packId) throw createError({ statusCode: 404, statusMessage: "Pack not found" });

  if (type === "all") {
    await Promise.all([
      db.update(whiteCards).set({ active }).where(eq(whiteCards.packId, packId)),
      db.update(blackCards).set({ active }).where(eq(blackCards.packId, packId)),
    ]);
    return { success: true };
  }

  const table = cardTable(type);
  await db.update(table).set({ active }).where(eq(table.packId, packId));
  return { success: true };
});
