// server/api/bot/add.post.ts
// Allows the lobby host to add a bot player to the lobby.
// Bots are stored as regular player documents with playerType='bot' and provider='bot'.
//
// Auth: Admin-SDK verified session via requireHost.
// Client must send Authorization + x-appwrite-user-id headers.
import { ID, Query } from "node-appwrite";

const MAX_BOTS_PER_LOBBY = 5;

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId } = body;

  if (!lobbyId) {
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });
  }

  // Session-based auth: verify the caller is the authenticated host
  await requireHost(event, lobbyId);

  const { DB, PLAYER, LOBBY } = getCollectionIds();
  const tables = getAdminTables();

  // --- Fetch lobby for status check ---
  const lobby = await tables.getRow({
    databaseId: DB,
    tableId: LOBBY,
    rowId: lobbyId,
  });

  // --- Check bot count cap ---
  const existingBots = await tables.listRows({
    databaseId: DB,
    tableId: PLAYER,
    queries: [
      Query.equal("lobbyId", lobbyId),
      Query.equal("playerType", "bot"),
      Query.limit(MAX_BOTS_PER_LOBBY + 1),
    ],
  });

  if (existingBots.total >= MAX_BOTS_PER_LOBBY) {
    throw createError({
      statusCode: 400,
      statusMessage: `Maximum of ${MAX_BOTS_PER_LOBBY} bots per lobby`,
    });
  }

  // --- Check lobby status (only allow adding bots in waiting phase) ---
  if (lobby.status !== "waiting") {
    throw createError({
      statusCode: 400,
      statusMessage: "Can only add bots while waiting",
    });
  }

  // --- Generate bot identity ---
  // Collect existing bot names in this lobby to avoid name collisions
  const existingBotNames = existingBots.rows.map(
    (doc: any) => doc.name as string,
  );
  const botName = generateBotName(existingBotNames);
  const botAvatar = getBotAvatarUrl(botName);

  // Unique userId for internal tracking (still uses a random suffix)
  const botSuffix = crypto
    .randomUUID()
    .replace(/-/g, "")
    .substring(0, 6)
    .toUpperCase();
  const botUserId = `bot_${botSuffix}`;

  // --- Create player document ---
  const playerDoc = await tables.createRow({
    databaseId: DB,
    tableId: PLAYER,
    rowId: ID.unique(),
    data: {
      userId: botUserId,
      lobbyId,
      name: botName,
      avatar: botAvatar,
      isHost: false,
      joinedAt: new Date().toISOString(),
      provider: "bot",
      playerType: "bot",
    },
    permissions: ['read("any")', 'update("any")', 'delete("any")'],
  });

  // --- Send system chat message server-side (no client round-trip) ---
  await sendSystemChatMessage(lobbyId, `${botName} joined the lobby`);

  return {
    success: true,
    bot: {
      $id: playerDoc.$id,
      userId: botUserId,
      name: botName,
      avatar: botAvatar,
      playerType: "bot",
    },
  };
});
