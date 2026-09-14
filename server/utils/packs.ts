/**
 * Pack identity. A pack is a `card_packs` row with a uuid `id` and a unique
 * `name`; cards point at it through `pack_id`. Renaming is a one-row update,
 * so nothing that holds an id — a lobby's pack selection, an admin URL — goes
 * stale when it happens.
 *
 * Non-id refs still arrive from two places: lobbies created before migration
 * 0012_pack_ids hold raw pack keys in `settings.cardPacks`, and the admin
 * client sends names until PR 2 moves it to ids. `resolvePackRefs` is the one
 * bridge for both (`legacyKeys` for the former), so no route re-implements
 * "is this an id, a key or a name?".
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

export interface ResolvePackRefsOptions {
  /**
   * The refs come from a lobby's `settings.cardPacks`. Before 0012_pack_ids
   * those held the raw pack key, and the migration promoted a pack's display
   * name to `name` — so a legacy ref is looked up by the retired
   * `card_packs.pack` key first, and only a ref no key matches falls back to
   * `name`. Key first is what keeps a key/display-name swap between two packs
   * resolving to the pack the lobby actually chose. This is the one sanctioned
   * read of a retired column; the column-drop migration must carry the mapping
   * forward (e.g. a `legacy_key` column) before dropping it.
   *
   * Off by default: admin routes send current names, never legacy keys.
   */
  legacyKeys?: boolean;
}

export async function resolvePackRefs(
  db: Db,
  refs: readonly unknown[],
  { legacyKeys = false }: ResolvePackRefsOptions = {},
): Promise<string[]> {
  const strings = [
    ...new Set(refs.filter((r): r is string => typeof r === "string" && r.trim() !== "")),
  ];
  if (!strings.length) return [];

  const resolved = new Set<string>();
  let names = strings.filter((r) => !isPackId(r));

  if (legacyKeys && names.length) {
    const keyed: { id: string; pack: string }[] = await db
      .select({ id: cardPacks.id, pack: cardPacks.pack })
      .from(cardPacks)
      .where(inArray(cardPacks.pack, names))
      .orderBy(cardPacks.id);
    // The retired column lost its uniqueness with the old primary key, so
    // pick one id per key deterministically rather than fan a ref out.
    const idByKey = new Map<string, string>();
    for (const row of keyed) if (!idByKey.has(row.pack)) idByKey.set(row.pack, row.id);
    for (const id of idByKey.values()) resolved.add(id);
    names = names.filter((n) => !idByKey.has(n));
  }

  const ids = strings.filter(isPackId);
  const conditions = [];
  if (ids.length) conditions.push(inArray(cardPacks.id, ids));
  if (names.length) conditions.push(inArray(cardPacks.name, names));

  if (conditions.length) {
    const rows: { id: string }[] = await db
      .select({ id: cardPacks.id })
      .from(cardPacks)
      .where(or(...conditions));
    for (const row of rows) resolved.add(row.id);
  }
  return [...resolved];
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

/** The admin pack-meta row: `pack` is the name under its pre-id key. */
export const packMetaColumns = {
  id: cardPacks.id,
  pack: cardPacks.name,
  description: cardPacks.description,
  icon: cardPacks.icon,
  color: cardPacks.color,
  sortOrder: cardPacks.sortOrder,
  official: cardPacks.official,
  nsfw: cardPacks.nsfw,
  series: cardPacks.series,
  isDefault: cardPacks.isDefault,
};

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
