// server/api/bot/remove.post.ts
// Allows the lobby host to remove a specific bot from the lobby.
//
// Auth: session-based, verified via requireHost.
import { and, eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { players, users } from "~/server/db/schema";
import { requireHost } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, botUserId } = body;

  if (!lobbyId) {
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });
  }
  if (!botUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: "botUserId is required",
    });
  }

  // Session-based auth: verify the caller is the authenticated host
  await requireHost(event, lobbyId);

  const db = useDb();

  // --- Find the bot player row ---
  const [bot] = await db
    .select()
    .from(players)
    .where(
      and(
        eq(players.userId, botUserId),
        eq(players.lobbyId, lobbyId),
        eq(players.playerType, "bot"),
      ),
    )
    .limit(1);

  if (!bot) {
    throw createError({
      statusCode: 404,
      statusMessage: "Bot not found in this lobby",
    });
  }

  // --- Delete the player row, then the synthetic bot user row ---
  await db.delete(players).where(eq(players.id, bot.id));
  await db.delete(users).where(eq(users.id, bot.userId));

  return { success: true };
});
