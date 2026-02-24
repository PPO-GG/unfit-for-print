// server/utils/system-chat.ts
// Shared utility for writing system chat messages directly from server endpoints.
// Eliminates the need for the client to make a separate POST /api/chat/system call.

import { ID, Permission, Role } from "node-appwrite";

const MAX_LENGTH = 255;

/**
 * Writes a system chat message to the gamechat collection.
 * Call this from any server endpoint that needs to broadcast a system event
 * (e.g. bot joined, player left, game started).
 */
export async function sendSystemChatMessage(
  lobbyId: string,
  text: string,
): Promise<string> {
  const { DB, GAMECHAT } = getCollectionIds();
  const databases = getAdminDatabases();
  const tables = getAdminTables();

  const safeText = text.substring(0, MAX_LENGTH);

  const doc = await tables.createRow({ databaseId: DB, tableId: GAMECHAT, rowId: ID.unique(), data: {
            lobbyId,
            senderId: "system",
            senderName: "System",
            text: safeText,
            timeStamp: new Date().toISOString(),
          }, permissions: [Permission.read(Role.any())] });

  return doc.$id;
}
