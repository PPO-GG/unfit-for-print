import { eq, and } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies, players } from "~~/server/db/schema";
import { requireAuth } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const body = await readBody<{
    code: string;
    playerName: string;
    avatar?: string;
    // "bot" is intentionally not accepted here — bots may only be created
    // via the dedicated /api/bot/add route (host-only, synthetic user).
    // A client-supplied "bot" is clamped to "player" below so a real user
    // can never get themselves classified (and later deleted) as a bot.
    playerType?: "spectator" | "player";
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

  // Runtime clamp: TypeScript's narrowed body type doesn't stop a raw
  // request body from smuggling "bot" (or anything else) past readBody.
  const playerType = body.playerType === "spectator" ? "spectator" : "player";

  const [player] = await db
    .insert(players)
    .values({
      userId,
      lobbyId: lobby.id,
      name: body.playerName,
      avatar: body.avatar,
      isHost: false,
      playerType,
    })
    .returning();

  return { lobby, player };
});
