import { desc, eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { reports, whiteCards, blackCards } from "~/server/db/schema";
import { requireAdmin } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const db = useDb();
  const allReports = await db.select().from(reports).orderBy(desc(reports.createdAt));

  const enriched = await Promise.all(
    allReports.map(async (report) => {
      const primary = report.cardType === "black" ? blackCards : whiteCards;
      const fallback = report.cardType === "black" ? whiteCards : blackCards;

      for (const [table, correctedType] of [
        [primary, report.cardType],
        [fallback, report.cardType === "black" ? "white" : "black"],
      ] as const) {
        const [card] = await db.select().from(table).where(eq(table.id, report.cardId)).limit(1);
        if (card) {
          return { ...report, cardType: correctedType, cardText: card.text, cardActive: card.active };
        }
      }
      return { ...report, cardText: null, cardActive: null };
    }),
  );

  return { reports: enriched };
});
