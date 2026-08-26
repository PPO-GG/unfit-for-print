import { and, eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { players } from "~/server/db/schema";
import { requireAuth } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const { playerId, avatarUrl } = await readBody<{
    playerId: string;
    avatarUrl: string | null;
  }>(event);

  const db = useDb();
  const [player] = await db
    .select({ id: players.id, userId: players.userId, lobbyId: players.lobbyId })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (!player) {
    throw createError({ statusCode: 404, statusMessage: "Player not found" });
  }

  // Only the player themself, or another member of the same lobby, may
  // update this avatar (same membership check as
  // requirePlayerInLobby in server/utils/session.ts, inlined here since we
  // already resolved the caller's userId above).
  if (player.userId !== userId) {
    const [membership] = await db
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.userId, userId), eq(players.lobbyId, player.lobbyId)))
      .limit(1);
    if (!membership) {
      throw createError({
        statusCode: 403,
        statusMessage: "You do not have permission to update this player's avatar",
      });
    }
  }

  await db
    .update(players)
    .set({ avatar: avatarUrl })
    .where(eq(players.id, playerId));
  return { success: true };
});
