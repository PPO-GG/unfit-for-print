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

  // Enrich reports with the actual card text so admins can see what was reported.
  // Resilience: if the card isn't found in the expected collection (e.g. due to
  // a past bug where WhiteCard.vue reported cards as "black"), try the opposite
  // collection before giving up.
  const enrichedReports = await Promise.all(
    result.rows.map(async (report: any) => {
      const primaryCollectionId =
        report.cardType === "black"
          ? config.public.appwriteBlackCardCollectionId
          : config.public.appwriteWhiteCardCollectionId;
      const fallbackCollectionId =
        report.cardType === "black"
          ? config.public.appwriteWhiteCardCollectionId
          : config.public.appwriteBlackCardCollectionId;

      // Try primary collection first, then fallback
      for (const collectionId of [primaryCollectionId, fallbackCollectionId]) {
        try {
          const card = await tables.getRow({
            databaseId: config.public.appwriteDatabaseId,
            tableId: collectionId,
            rowId: report.cardId,
          });

          // If found in the fallback collection, correct the cardType
          const correctedType =
            collectionId === fallbackCollectionId
              ? report.cardType === "black"
                ? "white"
                : "black"
              : report.cardType;

          return {
            ...report,
            cardType: correctedType,
            cardText: card.text ?? null,
            cardPack: card.pack ?? null,
            cardActive: card.active ?? null,
          };
        } catch {
          // Not found in this collection, try next
        }
      }

      // Card not found in either collection — likely deleted
      return {
        ...report,
        cardText: null,
        cardPack: null,
        cardActive: null,
      };
    }),
  );

  return { reports: enrichedReports };
});
