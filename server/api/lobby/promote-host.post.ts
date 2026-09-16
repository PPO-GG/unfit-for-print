import { eq, and } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies, players, users } from "~~/server/db/schema";
import { requireHost } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const { lobbyId, newHostUserId } = await readBody<{ lobbyId: string; newHostUserId: string }>(event);
  const currentHostId = await requireHost(event, lobbyId);

  const db = useDb();
  if (newHostUserId === currentHostId) return { success: true };

  const [newHostPlayer] = await db
    .select({ id: players.id, isGuest: users.isGuest })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .where(and(eq(players.userId, newHostUserId), eq(players.lobbyId, lobbyId)))
    .limit(1);
  if (!newHostPlayer) {
    throw createError({ statusCode: 400, statusMessage: "newHostUserId is not a player in this lobby" });
  }
  // Only a signed-in account may host, as lobby/create enforces. The player
  // list already hides the crown for guests; this is the half a client
  // cannot skip.
  if (newHostPlayer.isGuest) {
    throw createError({ statusCode: 400, statusMessage: "A guest cannot be made host" });
  }

  await db.update(lobbies).set({ hostUserId: newHostUserId }).where(eq(lobbies.id, lobbyId));
  await db
    .update(players)
    .set({ isHost: true })
    .where(and(eq(players.userId, newHostUserId), eq(players.lobbyId, lobbyId)));
  await db
    .update(players)
    .set({ isHost: false })
    .where(and(eq(players.userId, currentHostId), eq(players.lobbyId, lobbyId)));

  return { success: true };
});
