// server/api/admin/reports/index.ts
import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  await assertAdmin(event);

  const config = useRuntimeConfig();
  const tables = getAdminTables();

  // Fetch reports from the reports collection
  const result = await tables.listRows({
    databaseId: config.public.appwriteDatabaseId,
    tableId: config.public.appwriteReportsCollectionId,
    queries: [Query.orderDesc("$createdAt")],
  });

  // Enrich reports with the actual card text so admins can see what was reported
  const enrichedReports = await Promise.all(
    result.rows.map(async (report: any) => {
      try {
        const collectionId =
          report.cardType === "black"
            ? config.public.appwriteBlackCardCollectionId
            : config.public.appwriteWhiteCardCollectionId;

        const card = await tables.getRow({
          databaseId: config.public.appwriteDatabaseId,
          tableId: collectionId,
          rowId: report.cardId,
        });

        return {
          ...report,
          cardText: card.text ?? null,
          cardPack: card.pack ?? null,
          cardActive: card.active ?? null,
        };
      } catch {
        // Card may have been deleted already
        return {
          ...report,
          cardText: null,
          cardPack: null,
          cardActive: null,
        };
      }
    }),
  );

  return { reports: enrichedReports };
});
