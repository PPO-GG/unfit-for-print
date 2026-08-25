import { eq, and } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies, players } from "~/server/db/schema";
import { requireAuth } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const body = await readBody<{
    code: string;
    playerName: string;
    avatar?: string;
    playerType?: "spectator" | "player" | "bot";
  }>(event);

  const db = useDb();
  const [lobby] = await db.select().from(lobbies).where(eq(lobbies.code, body.code)).limit(1);
  if (!lobby) throw createError({ statusCode: 404, statusMessage: "Lobby not found" });

  const [existing] = await db
    .select()
    .from(players)
    .where(and(eq(players.userId, userId), eq(players.lobbyId, lobby.id)))
    .limit(1);
  if (existing) return { lobby, player: existing };

  const [player] = await db
    .insert(players)
    .values({
      userId,
      lobbyId: lobby.id,
      name: body.playerName,
      avatar: body.avatar,
      isHost: false,
      playerType: body.playerType ?? "player",
    })
    .returning();

  return { lobby, player };
});
