import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { cardTable } from "~/server/utils/cardTable";
import { requireAdmin } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { id, type, text, pick } = await readBody<{
    id: string;
    type: string;
    text: string;
    pick?: number;
  }>(event);
  const table = cardTable(type);
  const db = useDb();

  const updates: Record<string, unknown> = { text };
  if (type === "black" && typeof pick === "number") updates.pick = pick;

  const [updated] = await db.update(table).set(updates).where(eq(table.id, id)).returning();
  return updated;
});
