export default defineEventHandler(async (event) => {
  await assertAdmin(event);

  const docId = getRouterParam(event, "id");
  if (!docId) {
    throw createError({ statusCode: 400, statusMessage: "Missing decoration document ID" });
  }

  const body = await readBody(event);
  const { DB, DECORATIONS } = getCollectionIds();
  const tables = getAdminTables();

  const allowedFields = ["name", "description", "type", "rarity", "enabled", "freeForAll", "discordSkuId", "price", "sortOrder"];

  const data: Record<string, any> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }

  if (Object.keys(data).length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No valid fields to update" });
  }

  await tables.updateRow({
    databaseId: DB,
    tableId: DECORATIONS,
    rowId: docId,
    data,
  });

  return { success: true };
});
