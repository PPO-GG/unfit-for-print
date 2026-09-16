// server/api/lobby/kick.post.ts
// Lets the lobby host remove a human player from the lobby.
//
// Kicking used to happen only in the Y.Doc. The kicked player's row stayed in
// Postgres, so the game page's rejoin check (isInLobby) found them "still in
// the lobby" on their next refresh and seated them again. The Y.Doc side still
// runs on the host's client (useLobby.kickPlayer), which also leaves the marker
// that sends the kicked player home.
//
// Bots go through /api/bot/remove instead, which also deletes their synthetic
// account. The kicked player's own account is kept: their session still
// names it, and deleting it here would sign them out as a side effect.
//
// Auth: session-based, verified via requireHost.
import { and, eq, ne } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { players } from "~~/server/db/schema";
import { requireHost } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const { lobbyId, userId } = await readBody<{ lobbyId?: string; userId?: string }>(event);

  if (!lobbyId || !userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId and userId are required",
    });
  }

  const hostId = await requireHost(event, lobbyId);
  if (userId === hostId) {
    throw createError({
      statusCode: 400,
      statusMessage: "The host cannot kick themselves",
    });
  }

  const db = useDb();
  const removed = await db
    .delete(players)
    .where(
      and(
        eq(players.userId, userId),
        eq(players.lobbyId, lobbyId),
        ne(players.playerType, "bot"),
      ),
    )
    .returning({ id: players.id });

  if (removed.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: "Player not found in this lobby",
    });
  }

  return { success: true };
});
