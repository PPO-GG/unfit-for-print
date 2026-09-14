import { eq, sql } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { whiteCards, blackCards, cardPacks } from "~~/server/db/schema";

export interface PackStat {
  packId: string;
  /** The pack's current name. */
  pack: string;
  total: number;
  active: number;
}

export async function packStats(
  table: typeof whiteCards | typeof blackCards,
): Promise<PackStat[]> {
  const db = useDb();
  // Inner join: a card with no pack belongs to no pack stat, exactly as the
  // old `pack is not null` filter had it.
  const rows = await db
    .select({
      packId: cardPacks.id,
      pack: cardPacks.name,
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${table.active})::int`,
    })
    .from(table)
    .innerJoin(cardPacks, eq(table.packId, cardPacks.id))
    .groupBy(cardPacks.id, cardPacks.name)
    .orderBy(cardPacks.name);

  return rows;
}
