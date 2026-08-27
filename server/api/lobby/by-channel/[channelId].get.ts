import { eq, ne, and, desc } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies } from "~~/server/db/schema";

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, "channelId");
  return useDb()
    .select()
    .from(lobbies)
    .where(and(eq(lobbies.discordChannelId, channelId!), ne(lobbies.status, "complete")))
    .orderBy(desc(lobbies.createdAt))
    .limit(10);
});
