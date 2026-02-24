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

  // Only return safe data to the frontend
  return {
    name: lobby.name,
    code: lobby.code,
    hostUserId: lobby.hostUserId,
    isPrivate: lobby.isPrivate,
    currentPlayers: lobby.currentPlayers,
    // Add more fields as needed — but filter sensitive stuff
  };
});
