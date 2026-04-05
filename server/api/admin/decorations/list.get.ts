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

  return result.rows.map((doc: any) => ({
    $id: doc.$id,
    decorationId: doc.decorationId,
    name: doc.name,
    description: doc.description,
    type: doc.type,
    rarity: doc.rarity,
    enabled: doc.enabled,
    freeForAll: doc.freeForAll,
    discordSkuId: doc.discordSkuId || null,
    price: doc.price,
    sortOrder: doc.sortOrder,
  }));
});
