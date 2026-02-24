// server/api/bot/remove.post.ts
// Allows the lobby host to remove a specific bot from the lobby.
//
// Auth: Admin-SDK verified session via requireHost.
// Client must send Authorization + x-appwrite-user-id headers.
import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, botUserId } = body;

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

  // Session-based auth: verify the caller is the authenticated host
  await requireHost(event, lobbyId);

  const { DB, PLAYER } = getCollectionIds();
  const tables = getAdminTables();

  // --- Find the bot player document ---
  const botRes = await tables.listRows({
    databaseId: DB,
    tableId: PLAYER,
    queries: [
      Query.equal("userId", botUserId),
      Query.equal("lobbyId", lobbyId),
      Query.equal("playerType", "bot"),
      Query.limit(1),
    ],
  });

  if (botRes.total === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: "Bot not found in this lobby",
    });
  }

  // --- Delete the bot player document ---
  const botName = botRes.rows[0]!.name || botUserId;
  await tables.deleteRow({
    databaseId: DB,
    tableId: PLAYER,
    rowId: botRes.rows[0]!.$id,
  });

  // --- Send system chat message server-side ---
  await sendSystemChatMessage(lobbyId, `${botName} left the lobby`);

  return { success: true };
});
