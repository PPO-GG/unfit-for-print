import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { whiteCards, blackCards } from "~~/server/db/schema";
import { cardTable } from "~~/server/utils/cardTable";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { pack, type, active } = await readBody<{ pack: string; type: string; active: boolean }>(event);
  const db = useDb();

  if (type === "all") {
    await Promise.all([
      db.update(whiteCards).set({ active }).where(eq(whiteCards.pack, pack)),
      db.update(blackCards).set({ active }).where(eq(blackCards.pack, pack)),
    ]);
    return { success: true };
  }

  const table = cardTable(type);
  await db.update(table).set({ active }).where(eq(table.pack, pack));
  return { success: true };
});
