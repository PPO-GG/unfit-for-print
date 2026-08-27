import { and, eq, ilike } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { cardTable } from "~~/server/utils/cardTable";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const query = getQuery(event);
  const table = cardTable(query.type as string);
  const db = useDb();

  const conditions = [];
  if (query.pack) conditions.push(eq(table.pack, query.pack as string));
  if (query.pick && "pick" in table) conditions.push(eq((table as any).pick, Number(query.pick)));
  if (query.search) conditions.push(ilike(table.text, `%${query.search}%`));

  return db.select().from(table).where(conditions.length ? and(...conditions) : undefined);
});
