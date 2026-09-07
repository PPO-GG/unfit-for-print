// Admin-only pack metadata roster. Mirrors default-packs.get.ts: a flat list
// the client merges into its own pack map, rather than a join that would make
// the public /api/cards/packs hot path pay for admin-only columns.

import { useDb } from "~~/server/db/client";
import { cardPacks } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const db = useDb();
  const packs = await db.select().from(cardPacks);
  return { packs };
});
