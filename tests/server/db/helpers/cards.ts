// Fixture helpers for suites that touch cards and packs. Since 0012_pack_ids
// a card reaches its pack through `pack_id`, so the old one-liner fixture
// `{ text, pack: "Base" }` needs a registry row behind it. `insertCards` keeps
// that fixture shape working so suites stay readable.
import { eq, inArray } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { whiteCards, blackCards, cardPacks, defaultCardPacks } from "~/server/db/schema";

const db = useDb();

/** Cards before packs: `card_packs` rows are referenced by `pack_id`. */
export async function resetCardTables() {
  await db.delete(whiteCards);
  await db.delete(blackCards);
  await db.delete(defaultCardPacks);
  await db.delete(cardPacks);
}

/** The id for `name`, creating the row the first time; `extra` is applied either way. */
export async function seedPack(
  name: string,
  extra: Partial<typeof cardPacks.$inferInsert> = {},
): Promise<string> {
  const [existing] = await db
    .select({ id: cardPacks.id })
    .from(cardPacks)
    .where(eq(cardPacks.name, name));
  if (existing) {
    if (Object.keys(extra).length) {
      await db.update(cardPacks).set(extra).where(eq(cardPacks.id, existing.id));
    }
    return existing.id;
  }
  const [row] = await db
    .insert(cardPacks)
    .values({ ...extra, name })
    .returning({ id: cardPacks.id });
  return row!.id;
}

type WithPackName<T> = Omit<T, "packId" | "pack"> & { pack?: string | null };
type WhiteFixture = WithPackName<typeof whiteCards.$inferInsert>;
type BlackFixture = WithPackName<typeof blackCards.$inferInsert>;

export async function insertCards(
  table: typeof whiteCards,
  rows: WhiteFixture | WhiteFixture[],
): Promise<(typeof whiteCards.$inferSelect)[]>;
export async function insertCards(
  table: typeof blackCards,
  rows: BlackFixture | BlackFixture[],
): Promise<(typeof blackCards.$inferSelect)[]>;
export async function insertCards(table: any, rows: any): Promise<any[]> {
  const list = Array.isArray(rows) ? rows : [rows];
  const values = [];
  for (const { pack, ...rest } of list) {
    values.push({ ...rest, packId: pack ? await seedPack(pack) : null });
  }
  return db.insert(table).values(values).returning();
}

/** Every card's pack name, sorted. Null for cards with no pack. */
export async function packNamesOf(table: typeof whiteCards | typeof blackCards) {
  const rows = await db
    .select({ name: cardPacks.name })
    .from(table)
    .leftJoin(cardPacks, eq(table.packId, cardPacks.id));
  return rows.map((r) => r.name).sort();
}

export async function defaultPackNames(): Promise<string[]> {
  const rows = await db
    .select({ name: cardPacks.name })
    .from(cardPacks)
    .where(eq(cardPacks.isDefault, true));
  return rows.map((r) => r.name).sort();
}

/** Names for ids, in the same order as `ids`. */
export async function namesForPackIds(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await db
    .select({ id: cardPacks.id, name: cardPacks.name })
    .from(cardPacks)
    .where(inArray(cardPacks.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r.name]));
  return ids.map((id) => byId.get(id) ?? `<unknown ${id}>`);
}
