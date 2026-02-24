// server/api/bot/add.post.ts
// Allows the lobby host to add a bot player to the lobby.
// Bots are stored as regular player documents with playerType='bot' and provider='bot'.
//
// Auth: Instead of cookie-based auth (Appwrite cookies live on the Appwrite domain),
// we verify the host by checking that the provided userId matches the lobby's hostUserId
// AND that a player document exists for that userId in the lobby.
import { ID, Query } from "node-appwrite";

const MAX_BOTS_PER_LOBBY = 5;

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, hostUserId } = body;

  if (!lobbyId) {
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
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
  const tables = getAdminTables();

  // --- Verify caller is the host ---
  const lobby = await tables.getRow({ databaseId: DB, tableId: LOBBY, rowId: lobbyId });
  if (lobby.hostUserId !== hostUserId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Only the host can add bots",
    });
  }

  // Verify the host actually has a player document in the lobby
  const hostPlayer = await tables.listRows({ databaseId: DB, tableId: PLAYER, queries: [
          Query.equal("userId", hostUserId),
          Query.equal("lobbyId", lobbyId),
          Query.limit(1),
        ] });
  if (hostPlayer.total === 0) {
    throw createError({
      statusCode: 403,
      statusMessage: "Host not found in lobby",
    });
  }

  // --- Check bot count cap ---
  const existingBots = await tables.listRows({ databaseId: DB, tableId: PLAYER, queries: [
          Query.equal("lobbyId", lobbyId),
          Query.equal("playerType", "bot"),
          Query.limit(MAX_BOTS_PER_LOBBY + 1),
        ] });

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

  // --- Generate bot identity (crypto-random to avoid duplicates) ---
  const botSuffix = crypto
    .randomUUID()
    .replace(/-/g, "")
    .substring(0, 6)
    .toUpperCase();
  const botUserId = `bot_${botSuffix}`;
  const botName = `BOT-${botSuffix}`;

  // --- Create player document ---
  const playerDoc = await tables.createRow({ databaseId: DB, tableId: PLAYER, rowId: ID.unique(), data: {
            userId: botUserId,
            lobbyId,
            name: botName,
            avatar: "",
            isHost: false,
            joinedAt: new Date().toISOString(),
            provider: "bot",
            playerType: "bot",
          }, permissions: ['read("any")', 'update("any")', 'delete("any")'] });

  // --- Send system chat message server-side (no client round-trip) ---
  await sendSystemChatMessage(lobbyId, `${botName} joined the lobby`);

  return {
    success: true,
    bot: {
      $id: playerDoc.$id,
      userId: botUserId,
      name: botName,
      playerType: "bot",
    },
  };
});
