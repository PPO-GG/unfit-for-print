// server/api/players/convert.post.ts
// Mirrors a spectator -> player conversion into the players table.
//
// The conversion itself happens in the Y.Doc (useYjsGameEngine.convertToPlayer),
// which deals the cards and is authoritative for gameplay. Postgres carries its
// own `playerType` column that nothing was updating, so a converted spectator
// stayed a "spectator" in the database forever — wrong for anything server-side
// that trusts that column.

import { and, eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies, players } from "~~/server/db/schema";
import { requirePlayerInLobby } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const { lobbyId, playerId } = await readBody<{
    lobbyId?: string;
    playerId?: string;
  }>(event);

  if (!lobbyId || !playerId) {
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId and playerId are required",
    });
  }

  const userId = await requirePlayerInLobby(event, lobbyId);
  const db = useDb();

  // You may deal yourself in; only the host may deal in someone else.
  if (userId !== playerId) {
    const [lobby] = await db
      .select({ hostUserId: lobbies.hostUserId })
      .from(lobbies)
      .where(eq(lobbies.id, lobbyId))
      .limit(1);
    if (lobby?.hostUserId !== userId) {
      throw createError({
        statusCode: 403,
        statusMessage: "Only the host can convert another player",
      });
    }
  }

  await db
    .update(players)
    .set({ playerType: "player" })
    .where(
      and(
        eq(players.lobbyId, lobbyId),
        eq(players.userId, playerId),
        eq(players.playerType, "spectator"),
      ),
    );

  return { success: true };
});
