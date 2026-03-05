// server/api/admin/lobby/delete.post.ts
// Admin-only endpoint to cascade-delete a lobby and all associated data.
// Uses the server-side admin SDK to bypass Appwrite document-level permissions.

import { readBody, createError } from "h3";
import { Query } from "node-appwrite";

export default defineEventHandler(async (event) => {
  await assertAdmin(event);

  const body = await readBody<{ lobbyId?: string }>(event);
  const lobbyId = body.lobbyId;

  if (!lobbyId) {
    throw createError({ statusCode: 400, statusMessage: "Missing lobbyId" });
  }

  const { databases } = useAppwriteAdmin();
  const config = useRuntimeConfig();

  const DB_ID = config.public.appwriteDatabaseId as string;
  const LOBBY_COL = config.public.appwriteLobbyCollectionId as string;
  const PLAYER_COL = config.public.appwritePlayerCollectionId as string;
  const GAMECHAT_COL = config.public.appwriteGamechatCollectionId as string;
  const GAMESETTINGS_COL = config.public
    .appwriteGameSettingsCollectionId as string;

  try {
    // 1. Delete all players in the lobby
    const playersRes = await databases.listDocuments(DB_ID, PLAYER_COL, [
      Query.equal("lobbyId", lobbyId),
      Query.limit(200),
    ]);
    for (const player of playersRes.documents) {
      await databases.deleteDocument(DB_ID, PLAYER_COL, player.$id);
    }

    // 2. Delete all game chat messages
    const chatRes = await databases.listDocuments(DB_ID, GAMECHAT_COL, [
      Query.equal("lobbyId", lobbyId),
      Query.limit(500),
    ]);
    for (const msg of chatRes.documents) {
      await databases.deleteDocument(DB_ID, GAMECHAT_COL, msg.$id);
    }

    // 3. Delete game settings
    const settingsRes = await databases.listDocuments(DB_ID, GAMESETTINGS_COL, [
      Query.equal("lobbyId", lobbyId),
      Query.limit(50),
    ]);
    for (const setting of settingsRes.documents) {
      await databases.deleteDocument(DB_ID, GAMESETTINGS_COL, setting.$id);
    }

    // 4. Delete the lobby document itself
    await databases.deleteDocument(DB_ID, LOBBY_COL, lobbyId);

    return { success: true, lobbyId };
  } catch (err: any) {
    console.error("[admin/lobby/delete] Cascade delete failed:", err);
    throw createError({
      statusCode: 500,
      statusMessage: err?.message || "Failed to delete lobby",
    });
  }
});
