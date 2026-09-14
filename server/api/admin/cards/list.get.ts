import { and, eq, getTableColumns, ilike } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { cardPacks } from "~~/server/db/schema";
import { cardTable } from "~~/server/utils/cardTable";
import { findPackId } from "~~/server/utils/packs";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const query = getQuery(event);
  const table = cardTable(query.type as string);
  const db = useDb();

  const conditions = [];
  if (query.pack) {
    // An id or a name. An unknown pack lists nothing — never every card.
    const packId = await findPackId(db, query.pack);
    if (!packId) return [];
    conditions.push(eq(table.packId, packId));
  }
  if (query.pick && "pick" in table) conditions.push(eq((table as any).pick, Number(query.pick)));
  if (query.search) conditions.push(ilike(table.text, `%${query.search}%`));
  // Opt-in only: the card manager wants everything, but the duplicate scanner
  // asks for active cards so resolved duplicates stop resurfacing every scan.
  if (query.active !== undefined)
    conditions.push(eq(table.active, query.active !== "false"));

  // `pack` is overridden with the joined name: the column of that name on the
  // card row is retired and goes stale on the first rename.
  return db
    .select({ ...getTableColumns(table), pack: cardPacks.name })
    .from(table)
    .leftJoin(cardPacks, eq(table.packId, cardPacks.id))
    .where(conditions.length ? and(...conditions) : undefined);
});
