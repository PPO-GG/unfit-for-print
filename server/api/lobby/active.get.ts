import { eq, desc } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies, players } from "~~/server/db/schema";
import { requireAuth } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const db = useDb();

  const [playerRow] = await db
    .select()
    .from(players)
    .where(eq(players.userId, userId))
    .orderBy(desc(players.joinedAt))
    .limit(1);
  if (!playerRow) return null;

  const [lobby] = await db.select().from(lobbies).where(eq(lobbies.id, playerRow.lobbyId)).limit(1);
  if (!lobby) {
    // Orphaned player row (lobby deleted without the player-side cleanup catching it) — self-heal.
    await db.delete(players).where(eq(players.id, playerRow.id));
    return null;
  }
  return lobby;
});
