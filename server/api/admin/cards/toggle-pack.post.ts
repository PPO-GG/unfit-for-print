import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { cardTable } from "~/server/utils/cardTable";
import { requireAdmin } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { pack, type, active } = await readBody<{ pack: string; type: string; active: boolean }>(event);
  const table = cardTable(type);
  const db = useDb();

  await db.update(table).set({ active }).where(eq(table.pack, pack));
  return { success: true };
});
