import { defineEventHandler, getRouterParam } from "h3";
import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const lobbyId = getRouterParam(event, "lobbyId");

  if (!lobbyId) {
    return { error: "Missing lobby ID" };
  }

  const tables = getAdminTables();
  const config = useRuntimeConfig();

  const dbId = config.public.appwriteDatabaseId as string;
  const collectionId = config.public.appwriteGamecardsCollectionId as string;

  try {
    const res = await tables.listRows({
      databaseId: dbId,
      tableId: collectionId,
      queries: [Query.equal("lobbyId", lobbyId)],
    });

    if (!res.total) {
      return { error: "Game cards not found for this lobby" };
    }

    // Return the game cards data
    return res.rows[0];
  } catch (err) {
    console.error("Failed to fetch game cards:", err);
    return {
      error: "Failed to fetch game cards",
      details: err instanceof Error ? err.message : String(err),
    };
  }
});
