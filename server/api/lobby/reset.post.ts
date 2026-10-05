// server/api/lobby/reset.post.ts
// Mirrors a host's game reset into the lobby row.
//
// The reset itself happens in the Y.Doc (useYjsGameEngine.resetGame), which is
// authoritative for the game. The row's status is what game/start set it to,
// "playing", and nothing else wrote it back: until something reconciled it,
// /api/bot/add refused the host a bot and /api/lobby/join seated newcomers as
// spectators in a lobby that was back in its waiting room. game/start writes
// "playing" server-side the same way; this is its inverse.

import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies } from "~~/server/db/schema";
import { requireHost } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const { lobbyId } = await readBody<{ lobbyId?: string }>(event);
  if (!lobbyId) {
    throw createError({ statusCode: 400, statusMessage: "lobbyId is required" });
  }

  await requireHost(event, lobbyId);
  await useDb().update(lobbies).set({ status: "waiting" }).where(eq(lobbies.id, lobbyId));
  return { success: true };
});
