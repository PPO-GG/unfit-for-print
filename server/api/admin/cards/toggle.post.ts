import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { cardTable } from "~/server/utils/cardTable";
import { requireAdmin } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { id, type } = await readBody<{ id: string; type: string }>(event);
  const table = cardTable(type);
  const db = useDb();

  const [card] = await db.select().from(table).where(eq(table.id, id)).limit(1);
  if (!card) throw createError({ statusCode: 404, statusMessage: "Card not found" });

  const [updated] = await db
    .update(table)
    .set({ active: !card.active })
    .where(eq(table.id, id))
    .returning();
  return updated;
});
