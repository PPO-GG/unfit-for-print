// server/api/admin/submissions/delete.post.ts
// Admin-only endpoint to delete a lab submission

export default defineEventHandler(async (event) => {
  await assertAdmin(event);

  const { submissionId } = await readBody(event);

  if (!submissionId) {
    throw createError({
      statusCode: 400,
      message: "submissionId is required",
    });
  }

  const config = useRuntimeConfig();
  const tables = getAdminTables();

  await tables.deleteRow({
    databaseId: config.public.appwriteDatabaseId,
    tableId: config.public.appwriteSubmissionCollectionId,
    rowId: submissionId,
  });

  return { success: true };
});
