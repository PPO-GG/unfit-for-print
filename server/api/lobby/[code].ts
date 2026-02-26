import { defineEventHandler, getRouterParam } from "h3";
import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, "code")?.toUpperCase();

  if (!code) {
    return { error: "Missing lobby code" };
  }

  const tables = getAdminTables();
  const config = useRuntimeConfig();

  const dbId = config.public.appwriteDatabaseId as string;
  const collectionId = config.public.appwriteLobbyCollectionId as string;

  let res;
  try {
    res = await tables.listRows({
      databaseId: dbId,
      tableId: collectionId,
      queries: [Query.equal("code", code)],
    });
  } catch (err: any) {
    return createError({
      statusCode: 500,
      statusMessage: "Failed to fetch from Appwrite database: " + err.message,
    });
  }

  if (!res || !res.total || res.rows.length === 0) {
    return { error: "Lobby not found" };
  }

  const lobby = res.rows[0]!;

  // ── Enrich with lobby name from game settings ──────────────────────────
  let lobbyName: string | null = null;
  try {
    const settingsRes = await tables.listRows({
      databaseId: dbId,
      tableId: config.public.appwriteGameSettingsCollectionId as string,
      queries: [Query.equal("lobbyId", lobby.$id), Query.limit(1)],
    });
    if (settingsRes.total > 0 && settingsRes.rows[0]?.lobbyName) {
      lobbyName = settingsRes.rows[0].lobbyName as string;
    }
  } catch {
    // Non-critical — fall through with null
  }

  // ── Enrich with host display name from players collection ─────────────
  let hostName: string | null = null;
  if (lobby.hostUserId) {
    try {
      const playerRes = await tables.listRows({
        databaseId: dbId,
        tableId: config.public.appwritePlayerCollectionId as string,
        queries: [
          Query.equal("userId", lobby.hostUserId as string),
          Query.limit(1),
        ],
      });
      if (playerRes.total > 0 && playerRes.rows[0]?.name) {
        hostName = playerRes.rows[0].name as string;
      }
    } catch {
      // Non-critical — fall through with null
    }
  }

  // Only return safe data to the frontend
  return {
    name: lobby.name,
    code: lobby.code,
    hostUserId: lobby.hostUserId,
    isPrivate: lobby.isPrivate,
    currentPlayers: lobby.currentPlayers,
    lobbyName,
    hostName,
  };
});
