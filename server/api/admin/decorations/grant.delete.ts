import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  await assertAdmin(event);

  const body = await readBody(event);
  const { userId, decorationId } = body;

  if (!userId || !decorationId) {
    throw createError({ statusCode: 400, statusMessage: "userId and decorationId are required" });
  }

  const { DB, USER_DECORATIONS } = getCollectionIds();
  const tables = getAdminTables();

  const existing = await tables.listRows({
    databaseId: DB,
    tableId: USER_DECORATIONS,
    queries: [
      Query.equal("userId", userId),
      Query.equal("decorationId", decorationId),
      Query.limit(1),
    ],
  });

  if (existing.total === 0) {
    throw createError({ statusCode: 404, statusMessage: "User does not own this decoration" });
  }

  await tables.deleteRow({
    databaseId: DB,
    tableId: USER_DECORATIONS,
    rowId: existing.rows[0].$id,
  });

  return { success: true };
});
