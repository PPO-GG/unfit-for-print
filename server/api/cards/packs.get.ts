import { sql } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { whiteCards, blackCards } from "~~/server/db/schema";

interface PackStat {
  pack: string;
  total: number;
  active: number;
}

async function packStats(table: typeof whiteCards | typeof blackCards): Promise<PackStat[]> {
  const db = useDb();
  const rows = await db
    .select({
      pack: table.pack,
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${table.active})::int`,
    })
    .from(table)
    .where(sql`${table.pack} is not null`)
    .groupBy(table.pack);

  return rows.map((r) => ({ pack: r.pack as string, total: r.total, active: r.active }));
}

export default defineEventHandler(async () => {
  const [white, black] = await Promise.all([packStats(whiteCards), packStats(blackCards)]);
  return { white, black };
});
