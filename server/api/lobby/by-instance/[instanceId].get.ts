import { and, desc, eq, ne } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies } from "~~/server/db/schema";

// Drives the Activity menu's Play / Join label. It does not apply
// activity-play's dead-doc check, so it can say "Join" for a minute or so
// after a game is abandoned; pressing the button still does the right thing.
export default defineEventHandler(async (event) => {
  const instanceId = getRouterParam(event, "instanceId");
  const [lobby] = await useDb()
    .select()
    .from(lobbies)
    .where(
      and(eq(lobbies.discordInstanceId, instanceId!), ne(lobbies.status, "complete")),
    )
    .orderBy(desc(lobbies.createdAt))
    .limit(1);
  return lobby ?? null;
});
