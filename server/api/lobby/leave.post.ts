import { eq, and, ne } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies, players } from "~/server/db/schema";
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
    await db.delete(lobbies).where(eq(lobbies.id, lobbyId));
  }

  return { success: true };
});
