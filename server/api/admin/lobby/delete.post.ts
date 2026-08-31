// server/api/admin/lobby/delete.post.ts
// Admin-only endpoint to delete a lobby. Player rows cascade-delete via the
// players.lobbyId FK (onDelete: "cascade") — no manual per-row loop needed.
// Guest players' synthetic `users` rows do NOT cascade, so we capture and
// clean those up explicitly (see server/api/lobby/leave.post.ts for the
// same pattern).

import { and, eq, inArray, isNull } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies, players, users } from "~~/server/db/schema";
import { requireAdmin } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { lobbyId } = await readBody<{ lobbyId?: string }>(event);
  if (!lobbyId) {
    throw createError({ statusCode: 400, statusMessage: "Missing lobbyId" });
  }

  const db = useDb();

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

  return { success: true };
});

