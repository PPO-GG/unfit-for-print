// server/api/cards/browse.get.ts
//
// Public, paginated card listing for the Labs card-pack browser.
//
// Deliberately not a public alias of /api/admin/cards/list: that route is
// admin-gated and returns every matching row, which is fine for a moderation
// UI but not for public traffic rendering real card components. This one
// paginates server-side and only ever exposes active cards — what the browser
// shows is what a game can actually deal.

import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { blackCards, cardPacks, whiteCards } from "~~/server/db/schema";
import { cardTable } from "~~/server/utils/cardTable";

const DEFAULT_PER_PAGE = 24;
const MAX_PER_PAGE = 60;

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const type = (query.type as string) || "white";
  const table = cardTable(type);
  const db = useDb();

  const page = clampInt(query.page, 1, 1, Number.MAX_SAFE_INTEGER);
  const perPage = clampInt(query.perPage, DEFAULT_PER_PAGE, 1, MAX_PER_PAGE);

  const conditions = [eq(table.active, true)];
  if (query.pack) conditions.push(eq(table.pack, query.pack as string));
  if (query.search) conditions.push(ilike(table.text, `%${query.search}%`));
  const where = and(...conditions);

  const columns = {
    id: table.id,
    text: table.text,
    pack: table.pack,
    // Same two label columns /api/cards/resolve returns, for the same reason:
    // the card footer renders its pack and a single card has no roster to
    // derive a series prefix from. See app/utils/packName.ts.
    packDisplayName: cardPacks.displayName,
    packSeries: cardPacks.series,
    imageKey: table.imageKey,
    imageFormat: table.imageFormat,
    attachment: table.attachment,
    ...(table === blackCards ? { pick: blackCards.pick } : {}),
  };

  const [cards, totalRows] = await Promise.all([
    db
      .select(columns)
      .from(table)
      // LEFT, not inner: most packs have no card_packs row, and an inner join
      // would empty the gallery for all of them.
      .leftJoin(cardPacks, eq(table.pack, cardPacks.pack))
      .where(where)
      .orderBy(asc(table.text), asc(table.id))
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ total: sql<number>`count(*)::int` }).from(table).where(where),
  ]);

  return { cards, total: totalRows[0]?.total ?? 0, page, perPage };
});
