import { eq, and, ne, isNull, inArray } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies, players, users } from "~~/server/db/schema";
import { requireAuth } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const { lobbyId } = await readBody<{ lobbyId: string }>(event);

  const db = useDb();
  await db.delete(players).where(and(eq(players.userId, userId), eq(players.lobbyId, lobbyId)));

  // Clean up the leaving user's account if it's an ephemeral guest
  await db
    .delete(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.isGuest, true),
        isNull(users.discordUserId),
      ),
    );

  const remainingHumans = await db
    .select({ id: players.id })
    .from(players)
    .where(and(eq(players.lobbyId, lobbyId), ne(players.playerType, "bot")));

  if (remainingHumans.length === 0) {
    // Capture remaining player userIds before deleting the lobby so we can
    // clean up their ephemeral guest users (including bots and human guests)
    const lobbyPlayers = await db
      .select({ userId: players.userId })
      .from(players)
      .where(eq(players.lobbyId, lobbyId));

    await db.delete(lobbies).where(eq(lobbies.id, lobbyId));

    if (lobbyPlayers.length > 0) {
      const userIds = Array.from(new Set(lobbyPlayers.map((p) => p.userId)));
      await db
        .delete(users)
        .where(
          and(
            inArray(users.id, userIds),
            eq(users.isGuest, true),
            isNull(users.discordUserId),
          ),
        );
    }
  }

  return { success: true };
});

