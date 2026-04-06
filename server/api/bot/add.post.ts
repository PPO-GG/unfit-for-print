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
  const { lobbyId, activeBotUserIds } = body;

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
      Query.limit(100),
    ],
  });

  // If the client sent its authoritative bot list (from Y.Doc), prune any
  // Appwrite bot docs that aren't in that list — these are orphans left behind
  // by a previous session that didn't clean up properly.
  if (Array.isArray(activeBotUserIds) && activeBotUserIds.length < existingBots.rows.length) {
    const activeSet = new Set(activeBotUserIds);
    const orphans = existingBots.rows.filter((r: any) => !activeSet.has(r.userId));
    await Promise.all(
      orphans.map((r: any) =>
        tables.deleteRow({ databaseId: DB, tableId: PLAYER, rowId: r.$id }),
      ),
    );
    // Recompute list after pruning
    existingBots.rows = existingBots.rows.filter((r: any) => activeSet.has(r.userId));
  }

  if (existingBots.rows.length >= MAX_BOTS_PER_LOBBY) {
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
  const botSuffix = uuid().replace(/-/g, "").substring(0, 6).toUpperCase();
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
