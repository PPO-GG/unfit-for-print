import { useDb } from "~~/server/db/client";
import { cardTable } from "~~/server/utils/cardTable";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { type, text, pack, pick } = await readBody<{
    type: string;
    text: string;
    pack?: string;
    pick?: number;
  }>(event);
  const table = cardTable(type);
  const db = useDb();

  const values: Record<string, unknown> = { text, pack, active: true };
  if (type === "black") values.pick = pick ?? 1;

  const [created] = await db.insert(table).values(values as any).returning();
  return created;
});
