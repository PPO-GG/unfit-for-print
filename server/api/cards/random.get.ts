import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { cardPacks } from "~~/server/db/schema";
import { cardTable } from "~~/server/utils/cardTable";
import { findPackId } from "~~/server/utils/packs";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const table = cardTable(query.type as string);
  const db = useDb();

  const conditions = [eq(table.active, true)];
  if (query.pack) {
    const packId = await findPackId(db, query.pack);
    if (!packId) return null;
    conditions.push(eq(table.packId, packId));
  }
  if (query.type === "black" && query.pick) {
    conditions.push(eq((table as any).pick, Number(query.pick)));
  }

  // Every column the bare `.select()` used to return, plus the labelling
  // columns the card footer needs — a single card has no roster to derive a
  // series prefix from, so the metadata has to ride along (see
  // app/utils/packName.ts). Spelled out rather than left implicit because a
  // join under a bare `.select()` nests the result by table and would break
  // every caller reading `card.text`.
  const [card] = await db
    .select({
      ...getTableColumns(table),
      pack: cardPacks.name,
      packSeries: cardPacks.series,
    })
    .from(table)
    // LEFT: most packs have no card_packs row, and an inner join would leave
    // the landing page with no card to show at all.
    .leftJoin(cardPacks, eq(table.packId, cardPacks.id))
    .where(and(...conditions))
    .orderBy(sql`random()`)
    .limit(1);

  return card ?? null;
});
