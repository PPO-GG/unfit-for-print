import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies } from "~~/server/db/schema";

export default defineEventHandler(async (event) => {
  const instanceId = getRouterParam(event, "instanceId");
  const [lobby] = await useDb()
    .select()
    .from(lobbies)
    .where(eq(lobbies.discordInstanceId, instanceId!))
    .limit(1);
  return lobby ?? null;
});
