// Bulk-set `series` across many packs in one upsert, so assigning ~106 packs
// to the same brand doesn't take 106 round trips. Deliberately scoped to
// `series` alone rather than the whole metadata row — the other fields stay
// single-pack, edited through pack-meta.post.ts, where a mistake only ever
// touches one row.

import { useDb } from "~~/server/db/client";
import { cardPacks } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody<{ packs?: string[]; series?: string | null }>(event);

  const packs = Array.isArray(body.packs)
    ? [...new Set(
        body.packs
          .map((p) => (typeof p === "string" ? p.trim() : ""))
          .filter(Boolean),
      )]
    : [];
  if (!packs.length) {
    throw createError({ statusCode: 400, statusMessage: "packs is required" });
  }
  const series = typeof body.series === "string" ? body.series.trim() || null : null;

  const db = useDb();
  // One statement, not a loop: Postgres applies ON CONFLICT per inserted row,
  // so this creates a bare row for any pack with no metadata yet and updates
  // `series` (and nothing else) on any pack that already has one.
  const rows = await db
    .insert(cardPacks)
    .values(packs.map((pack) => ({ pack, series })))
    .onConflictDoUpdate({ target: cardPacks.pack, set: { series } })
    .returning();

  return { packs: rows };
});
