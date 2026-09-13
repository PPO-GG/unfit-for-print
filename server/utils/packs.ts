/**
 * Pack identity. A pack is a `card_packs` row with a uuid `id` and a unique
 * `name`; cards point at it through `pack_id`. Renaming is a one-row update,
 * so nothing that holds an id — a lobby's pack selection, an admin URL — goes
 * stale when it happens.
 *
 * Names still arrive from two places: lobbies created before migration
 * 0012_pack_ids hold names in `settings.cardPacks`, and the admin client sends
 * names until PR 2 moves it to ids. `resolvePackRefs` is the one bridge for
 * both, so no route re-implements "is this an id or a name?".
 */
import { eq, inArray, or, sql } from "drizzle-orm";
import { whiteCards, blackCards, cardPacks } from "~~/server/db/schema";
import { normalizePackText } from "#shared/packMetaText";

// The pool or a transaction — same `tx: any` idiom as move.post.ts, since
// Drizzle's transaction type and the database type share no usable supertype.
type Db = any;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPackId(ref: unknown): ref is string {
  return typeof ref === "string" && UUID_RE.test(ref);
}

export async function resolvePackRefs(db: Db, refs: readonly unknown[]): Promise<string[]> {
  const strings = [
    ...new Set(refs.filter((r): r is string => typeof r === "string" && r.trim() !== "")),
  ];
  if (!strings.length) return [];

  const ids = strings.filter(isPackId);
  const names = strings.filter((r) => !isPackId(r));
  const conditions = [];
  if (ids.length) conditions.push(inArray(cardPacks.id, ids));
  if (names.length) conditions.push(inArray(cardPacks.name, names));

  const rows: { id: string }[] = await db
    .select({ id: cardPacks.id })
    .from(cardPacks)
    .where(or(...conditions));
  return rows.map((r) => r.id);
}

export async function findPackId(db: Db, ref: unknown): Promise<string | null> {
  const [id] = await resolvePackRefs(db, [ref]);
  return id ?? null;
}

/**
 * The id for a pack name, creating the pack if nothing has that name yet.
 * Trims but does not collapse whitespace: real names contain double spaces,
 * and normalising here would silently fork "A  B" into a second pack "A B".
 */
export async function ensurePackByName(db: Db, rawName: string): Promise<string> {
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: "pack name is required" });
  }
  await db.insert(cardPacks).values({ name }).onConflictDoNothing({ target: cardPacks.name });
  const [row] = await db
    .select({ id: cardPacks.id })
    .from(cardPacks)
    .where(eq(cardPacks.name, name));
  return row.id;
}

export async function packNameFor(
  db: Db,
  packId: string | null | undefined,
): Promise<string | null> {
  if (!packId) return null;
  const [row] = await db
    .select({ name: cardPacks.name })
    .from(cardPacks)
    .where(eq(cardPacks.id, packId));
  return row?.name ?? null;
}

/** Rename in place. A name typed by an admin is normalised, unlike lookups. */
export async function renamePack(db: Db, id: string, rawName: string) {
  const name = normalizePackText(rawName);
  if (!name) throw createError({ statusCode: 400, statusMessage: "name is required" });

  const [clash] = await db
    .select({ id: cardPacks.id })
    .from(cardPacks)
    .where(eq(cardPacks.name, name));
  if (clash && clash.id !== id) {
    throw createError({
      statusCode: 409,
      statusMessage: `A pack named "${name}" already exists`,
      data: { conflictId: clash.id },
    } as any);
  }

  const [row] = await db
    .update(cardPacks)
    .set({ name })
    .where(eq(cardPacks.id, id))
    .returning();
  if (!row) throw createError({ statusCode: 404, statusMessage: "Pack not found" });
  return row as typeof cardPacks.$inferSelect;
}

/**
 * Fold `sourceIds` into `targetId`: repoint every card, then delete the
 * source rows. The target keeps its own name, metadata and default flag.
 * Run it inside the caller's transaction so a failure leaves nothing half-moved.
 */
export async function mergePacks(db: Db, sourceIds: string[], targetId: string) {
  const sources = [...new Set(sourceIds)].filter((id) => id !== targetId);
  const [target] = await db
    .select({ id: cardPacks.id })
    .from(cardPacks)
    .where(eq(cardPacks.id, targetId));
  if (!target) throw createError({ statusCode: 404, statusMessage: "Target pack not found" });
  if (!sources.length) return { white: 0, black: 0 };

  const white = await db
    .update(whiteCards)
    .set({ packId: targetId })
    .where(inArray(whiteCards.packId, sources))
    .returning({ id: whiteCards.id });
  const black = await db
    .update(blackCards)
    .set({ packId: targetId })
    .where(inArray(blackCards.packId, sources))
    .returning({ id: blackCards.id });
  await db.delete(cardPacks).where(inArray(cardPacks.id, sources));

  return { white: white.length, black: black.length };
}

export async function packCardCounts(db: Db, packId: string) {
  const count = async (table: typeof whiteCards | typeof blackCards) => {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(table)
      .where(eq(table.packId, packId));
    return row?.n ?? 0;
  };
  return { white: await count(whiteCards), black: await count(blackCards) };
}
