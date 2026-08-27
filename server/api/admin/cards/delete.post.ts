import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { cardTable } from "~~/server/utils/cardTable";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { id, type } = await readBody<{ id: string; type: string }>(event);
  const table = cardTable(type);
  await useDb().delete(table).where(eq(table.id, id));
  return { success: true };
});
