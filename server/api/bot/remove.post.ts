// server/api/bot/remove.post.ts
// Allows the lobby host to remove a specific bot from the lobby.
import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, botUserId, hostUserId } = body;

  if (!lobbyId) {
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });
  }
  if (!botUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: "botUserId is required",
    });
  }
  if (!hostUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: "hostUserId is required",
    });
  }

  const { DB, PLAYER, LOBBY } = getCollectionIds();
  const databases = getAdminDatabases();

  // --- Verify caller is the host ---
  const lobby = await databases.getDocument(DB, LOBBY, lobbyId);
  if (lobby.hostUserId !== hostUserId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Only the host can remove bots",
    });
  }

  // --- Find the bot player document ---
  const botRes = await databases.listDocuments(DB, PLAYER, [
    Query.equal("userId", botUserId),
    Query.equal("lobbyId", lobbyId),
    Query.equal("playerType", "bot"),
    Query.limit(1),
  ]);

  if (botRes.total === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: "Bot not found in this lobby",
    });
  }

  // --- Delete the bot player document ---
  const botName = botRes.documents[0]!.name || botUserId;
  await databases.deleteDocument(DB, PLAYER, botRes.documents[0]!.$id);

  // --- Send system chat message server-side ---
  await sendSystemChatMessage(lobbyId, `${botName} left the lobby`);

  return { success: true };
});
