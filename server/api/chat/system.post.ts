// server/api/chat/system.post.ts
// Server-side endpoint for sending system messages to the lobby chat.
// Used by the game realtime composable for join/leave/kick notifications.
// No rate limiting on system messages — they are server-initiated events.

import { ID, Permission, Role } from "node-appwrite";

const MAX_LENGTH = 255;

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, text, userId } = body;

  // ── Validate inputs ────────────────────────────────────────────────
  if (!lobbyId) {
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });
  }
  if (!text || typeof text !== "string") {
    throw createError({ statusCode: 400, statusMessage: "text is required" });
  }

  // ── Verify caller is a player in the lobby (prevents abuse) ────────
  // System messages are triggered from the client but only by players in the lobby.
  if (userId) {
    await verifyPlayerInLobby(userId, lobbyId);
  }

  // ── Write system message ───────────────────────────────────────────
  const { DB, GAMECHAT } = getCollectionIds();
  const databases = getAdminDatabases();

  const safeText = text.substring(0, MAX_LENGTH);

  const doc = await databases.createDocument(
    DB,
    GAMECHAT,
    ID.unique(),
    {
      lobbyId,
      senderId: "system",
      senderName: "System",
      text: safeText,
      timeStamp: new Date().toISOString(),
    },
    [Permission.read(Role.any())],
  );

  return { success: true, messageId: doc.$id };
});
