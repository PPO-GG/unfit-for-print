import { eq, and } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies, players } from "~/server/db/schema";
import { requireHost } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  const { lobbyId, newHostUserId } = await readBody<{ lobbyId: string; newHostUserId: string }>(event);
  const currentHostId = await requireHost(event, lobbyId);

  const db = useDb();
  if (newHostUserId === currentHostId) return { success: true };

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
