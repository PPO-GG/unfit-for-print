// server/api/admin/lobby/update-status.post.ts
// Admin-only endpoint to update a lobby's status field.
// Uses the server-side admin SDK to bypass Appwrite document-level permissions.

import { readBody, createError } from "h3";

const ALLOWED_STATUSES = ["waiting", "active", "playing", "complete"] as const;
type LobbyStatus = (typeof ALLOWED_STATUSES)[number];

export default defineEventHandler(async (event) => {
  await assertAdmin(event);

  const body = await readBody<{ lobbyId?: string; status?: string }>(event);
  const { lobbyId, status } = body;

  if (!lobbyId) {
    throw createError({ statusCode: 400, statusMessage: "Missing lobbyId" });
  }
  if (!status || !ALLOWED_STATUSES.includes(status as LobbyStatus)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(", ")}`,
    });
  }

  const { databases } = useAppwriteAdmin();
  const config = useRuntimeConfig();

  const DB_ID = config.public.appwriteDatabaseId as string;
  const LOBBY_COL = config.public.appwriteLobbyCollectionId as string;

  try {
    const updated = await databases.updateDocument(DB_ID, LOBBY_COL, lobbyId, {
      status,
    });
    return { success: true, document: updated };
  } catch (err: any) {
    console.error("[admin/lobby/update-status] Update failed:", err);
    throw createError({
      statusCode: 500,
      statusMessage: err?.message || "Failed to update lobby status",
    });
  }
});
