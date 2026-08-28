import { useDb } from "~~/server/db/client";
import { decorations } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);

  // Generate a unique decorationId for attachment-type decorations
  const decorationId = body.decorationId || `attachment-${Date.now()}`;

  const [row] = await useDb()
    .insert(decorations)
    .values({
      id: decorationId,
      name: body.name || "New Attachment",
      description: body.description || "",
      type: body.type || "attachment",
      rarity: body.rarity || "common",
      category: body.category || "custom",
      enabled: body.enabled ?? false,
      freeForAll: body.freeForAll ?? false,
      discordSkuId: body.discordSkuId || null,
      price: String(body.price ?? 0),
      sortOrder: body.sortOrder ?? 999,
      imageKey: body.imageFileId || null,
      imageFormat: body.imageFormat || null,
      attachment: body.attachment
        ? typeof body.attachment === "string"
          ? JSON.parse(body.attachment)
          : body.attachment
        : null,
    })
    .returning();

  return {
    $id: row.id,
    decorationId: row.id,
    name: row.name,
  };
});
