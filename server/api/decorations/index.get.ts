import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const { DB } = getCollectionIds();
  const config = useRuntimeConfig();
  const tables = getAdminTables();

  const result = await tables.listRows({
    databaseId: DB,
    tableId: config.public.appwriteUserDecorationsCollectionId as string,
    queries: [Query.equal("userId", userId)],
  });

  return result.rows.map((doc: any) => ({
    decorationId: doc.decorationId,
    acquiredAt: doc.acquiredAt,
    source: doc.source,
  }));
});
