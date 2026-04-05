import { ID } from "node-appwrite";

export default defineEventHandler(async (event) => {
  await assertAdmin(event);

  const body = await readBody(event);
  const { DB, DECORATIONS } = getCollectionIds();
  const tables = getAdminTables();

  // Generate a unique decorationId for attachment-type decorations
  const decorationId = body.decorationId || `attachment-${Date.now()}`;

  const data: Record<string, any> = {
    decorationId,
    name: body.name || "New Attachment",
    description: body.description || "",
    type: body.type || "attachment",
    rarity: body.rarity || "common",
    category: body.category || "custom",
    enabled: body.enabled ?? false,
    freeForAll: body.freeForAll ?? false,
    discordSkuId: body.discordSkuId || null,
    price: body.price ?? 0,
    sortOrder: body.sortOrder ?? 999,
    imageFileId: body.imageFileId || null,
    attachment: body.attachment || null,
  };

  const doc = await tables.createRow({
    databaseId: DB,
    tableId: DECORATIONS,
    rowId: ID.unique(),
    data,
  });

  return {
    $id: doc.$id,
    decorationId: data.decorationId,
    name: data.name,
  };
});
