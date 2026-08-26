import { and, eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies, players } from "~/server/db/schema";

// Public, unauthenticated route — only expose fields the client actually
// needs for the lobby-detail view / SEO metadata. Never leak
// discordInstanceId, discordChannelId, or hostUserId here.
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
    .where(
      and(
        eq(players.userId, lobby.hostUserId),
        eq(players.lobbyId, lobby.id),
      ),
    )
    .limit(1);

  return {
    id: lobby.id,
    code: lobby.code,
    status: lobby.status,
    lobbyName: lobby.lobbyName ?? null,
    createdAt: lobby.createdAt,
    hostName: host?.name ?? null,
  };
});
