import { desc, eq, getTableColumns } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { reports, whiteCards, blackCards, cardPacks } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

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
        const [card] = await db
          .select({ ...getTableColumns(table), packName: cardPacks.name })
          .from(table)
          .leftJoin(cardPacks, eq(table.packId, cardPacks.id))
          .where(eq(table.id, report.cardId))
          .limit(1);
        if (card) {
          return {
            ...report,
            cardType: correctedType,
            cardText: card.text,
            cardPack: card.packName ?? null,
            cardActive: card.active,
            cardPick: "pick" in card ? card.pick : null,
          };
        }
      }
      return { ...report, cardText: null, cardPack: null, cardActive: null, cardPick: null };
    }),
  );

  return { reports: enriched };
});
