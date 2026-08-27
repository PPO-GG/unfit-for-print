import { eq, desc } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { players } from "~~/server/db/schema";

export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, "userId");
  const [player] = await useDb()
    .select()
    .from(players)
    .where(eq(players.userId, userId!))
    .orderBy(desc(players.joinedAt))
    .limit(1);
  return player ?? null;
});
