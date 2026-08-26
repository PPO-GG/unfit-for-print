import { eq, and, ne, isNull, inArray } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies, players, users } from "~/server/db/schema";
import { requireAuth } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const { lobbyId } = await readBody<{ lobbyId: string }>(event);

  const db = useDb();
  await db.delete(players).where(and(eq(players.userId, userId), eq(players.lobbyId, lobbyId)));

  const remainingHumans = await db
    .select({ id: players.id })
    .from(players)
    .where(and(eq(players.lobbyId, lobbyId), ne(players.playerType, "bot")));

  if (remainingHumans.length === 0) {
    // Capture the lobby's bot userIds *before* deleting the lobby — the
    // players rows cascade-delete with it, but their synthetic `users`
    // rows do not (no cascade in that direction), so we must clean those
    // up ourselves once the lobby (and its players) are gone.
    const bots = await db
      .select({ userId: players.userId })
      .from(players)
      .where(and(eq(players.lobbyId, lobbyId), eq(players.playerType, "bot")));

    await db.delete(lobbies).where(eq(lobbies.id, lobbyId));

    if (bots.length > 0) {
      await db
        .delete(users)
        .where(
          and(
            inArray(
              users.id,
              bots.map((b) => b.userId),
            ),
            eq(users.isGuest, true),
            isNull(users.discordUserId),
          ),
        );
    }
  }

  return { success: true };
});
