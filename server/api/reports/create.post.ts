import { useDb } from "~~/server/db/client";
import { reports } from "~~/server/db/schema";
import { requireAuth } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const { cardId, cardType, reason } = await readBody<{
    cardId: string;
    cardType: "white" | "black";
    reason: string;
  }>(event);

  const [created] = await useDb()
    .insert(reports)
    .values({ cardId, cardType, reason, reportedBy: userId })
    .returning();
  return created;
});
