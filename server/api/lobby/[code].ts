import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies, players } from "~/server/db/schema";

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, "code");
  const db = useDb();

  const [lobby] = await db
    .select()
    .from(lobbies)
    .where(eq(lobbies.code, code!))
    .limit(1);
  if (!lobby) throw createError({ statusCode: 404, statusMessage: "Lobby not found" });

  const [host] = await db
    .select({ name: players.name })
    .from(players)
    .where(eq(players.userId, lobby.hostUserId))
    .limit(1);

  return { ...lobby, hostName: host?.name ?? null };
});
