// server/api/admin/reports/dismiss.post.ts
export default defineEventHandler(async (event) => {
  await assertAdmin(event);

  const body = await readBody(event);
  const { reportId } = body;

  if (!reportId) {
    throw createError({ statusCode: 400, message: "reportId is required" });
  }

  const config = useRuntimeConfig();
  const tables = getAdminTables();

  await tables.deleteRow({
    databaseId: config.public.appwriteDatabaseId,
    tableId: config.public.appwriteReportsCollectionId,
    rowId: reportId,
  });

  return { success: true };
});
