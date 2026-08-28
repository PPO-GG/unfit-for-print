import { asc } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { decorations } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const rows = await useDb()
    .select()
    .from(decorations)
    .orderBy(asc(decorations.sortOrder))
    .limit(500);

  return rows.map((row) => ({
    $id: row.id,
    decorationId: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    rarity: row.rarity,
    category: row.category || "custom",
    enabled: row.enabled,
    freeForAll: row.freeForAll,
    discordSkuId: row.discordSkuId || null,
    price: Number(row.price),
    sortOrder: row.sortOrder,
    imageFileId: row.imageKey || null,
    imageFormat: row.imageFormat || null,
    attachment: row.attachment ?? null,
  }));
});
