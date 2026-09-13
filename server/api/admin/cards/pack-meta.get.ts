// Admin-only pack metadata roster. Mirrors default-packs.get.ts: a flat list
// the client merges into its own pack map, rather than a join that would make
// the public /api/cards/packs hot path pay for admin-only columns.

import { useDb } from "~~/server/db/client";
import { cardPacks } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  // `pack` is the name under its pre-id key — the admin client indexes this
  // roster by it. The retired `pack`/`display_name` columns are never sent.
  const packs = await useDb()
    .select({
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
    })
    .from(cardPacks)
    .orderBy(cardPacks.name);
  return { packs };
});
