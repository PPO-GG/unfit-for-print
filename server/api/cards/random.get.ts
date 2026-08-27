import { and, eq, sql } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { cardTable } from "~~/server/utils/cardTable";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const table = cardTable(query.type as string);
  const db = useDb();

  const conditions = [eq(table.active, true)];
  if (query.pack) conditions.push(eq(table.pack, query.pack as string));
  if (query.type === "black" && query.pick) {
    conditions.push(eq((table as any).pick, Number(query.pick)));
  }

  const [card] = await db
    .select()
    .from(table)
    .where(and(...conditions))
    .orderBy(sql`random()`)
    .limit(1);

  return card ?? null;
});
