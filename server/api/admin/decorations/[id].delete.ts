export default defineEventHandler(async (event) => {
  await assertAdmin(event);

  const docId = getRouterParam(event, "id");
  if (!docId) {
    throw createError({ statusCode: 400, statusMessage: "Missing decoration document ID" });
  }

  const { DB, DECORATIONS } = getCollectionIds();
  const tables = getAdminTables();

  await tables.deleteRow({
    databaseId: DB,
    tableId: DECORATIONS,
    rowId: docId,
  });

  return { success: true };
});
