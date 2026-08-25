// server/api/admin/lobby/delete.post.ts
// Admin-only endpoint to delete a lobby. Player rows cascade-delete via the
// players.lobbyId FK (onDelete: "cascade") — no manual per-row loop needed.

import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies } from "~/server/db/schema";
import { requireAdmin } from "~/server/utils/session";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { lobbyId } = await readBody<{ lobbyId?: string }>(event);
  if (!lobbyId) {
    throw createError({ statusCode: 400, statusMessage: "Missing lobbyId" });
  }
  await useDb().delete(lobbies).where(eq(lobbies.id, lobbyId));
  return { success: true };
});
