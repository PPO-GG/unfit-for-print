// Bulk-set `series` across many packs in one update, so assigning ~106 packs
// to the same brand doesn't take 106 round trips. Deliberately scoped to
// `series` alone rather than the whole metadata row — the other fields stay
// single-pack, edited through pack-meta.post.ts, where a mistake only ever
// touches one row.

import { inArray } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { cardPacks } from "~~/server/db/schema";
import { ensurePackByName, findPackId, isPackId, packMetaColumns } from "~~/server/utils/packs";
import { requireAdmin } from "~~/server/utils/session";
import { normalizePackText } from "#shared/packMetaText";

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
  // Same normalization as the single-pack route — this one writes the field
  // across ~106 rows at once, so a stray double space here is 106 bad rows.
  const series = normalizePackText(body.series);

  const db = useDb();
  // Ids resolve as-is; names are created when missing, matching the old
  // upsert that gave every named pack a row.
  const ids: string[] = [];
  for (const ref of packs) {
    ids.push(isPackId(ref) ? ((await findPackId(db, ref)) ?? "") : await ensurePackByName(db, ref));
  }
  const known = [...new Set(ids.filter(Boolean))];
  if (!known.length) return { packs: [] };

  await db.update(cardPacks).set({ series }).where(inArray(cardPacks.id, known));
  const rows = await db.select(packMetaColumns).from(cardPacks).where(inArray(cardPacks.id, known));
  return { packs: rows };
});
