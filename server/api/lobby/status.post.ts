// server/api/lobby/status.post.ts
// Host-gated endpoint for syncing the lobby's status field from the Y.Doc
// back to Postgres (e.g. game complete, reset to waiting). Distinct from
// /api/admin/lobby/update-status, which is admin-only.

import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies } from "~/server/db/schema";
import { requireHost } from "~/server/utils/session";

const ALLOWED_STATUSES = ["waiting", "playing", "complete"] as const;
type LobbyStatus = (typeof ALLOWED_STATUSES)[number];

export default defineEventHandler(async (event) => {
  const { lobbyId, status } = await readBody<{
    lobbyId?: string;
    status?: string;
  }>(event);

  if (!lobbyId) {
    throw createError({ statusCode: 400, statusMessage: "Missing lobbyId" });
  }
  if (!status || !ALLOWED_STATUSES.includes(status as LobbyStatus)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(", ")}`,
    });
  }

  await requireHost(event, lobbyId);
  await useDb()
    .update(lobbies)
    .set({ status: status as LobbyStatus })
    .where(eq(lobbies.id, lobbyId));
  return { success: true };
});
