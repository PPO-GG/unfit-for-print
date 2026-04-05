import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  await assertAdmin(event);

  const { DB, DECORATIONS } = getCollectionIds();
  const tables = getAdminTables();

  const result = await tables.listRows({
    databaseId: DB,
    tableId: DECORATIONS,
    queries: [Query.orderAsc("sortOrder"), Query.limit(500)],
  });

  return result.rows.map((doc: any) => {
    let attachment = null;
    if (doc.attachment) {
      try {
        attachment = JSON.parse(doc.attachment);
      } catch { /* ignore malformed JSON */ }
    }
    return {
      $id: doc.$id,
      decorationId: doc.decorationId,
      name: doc.name,
      description: doc.description,
      type: doc.type,
      rarity: doc.rarity,
      category: doc.category || 'custom',
      enabled: doc.enabled,
      freeForAll: doc.freeForAll,
      discordSkuId: doc.discordSkuId || null,
      price: doc.price,
      sortOrder: doc.sortOrder,
      imageFileId: doc.imageFileId || null,
      imageFormat: doc.imageFormat || null,
      attachment,
    };
  });
});
