// server/utils/verifyPlayer.ts
// Lightweight player/host verification for Nitro API routes.
//
// The Appwrite session cookie lives on the Appwrite server's domain (e.g., api.ppo.gg),
// NOT on the app's domain (localhost / app domain). This means Nitro server routes
// cannot extract the session from cookies. Instead, the client passes its userId
// in the request body, and we verify it against the lobby/player documents.
//
// Security model:
// - The userId is the Appwrite user's $id, which is not secret but also not guessable
// - We verify the userId exists as a player document in the specified lobby
// - For host actions, we additionally verify lobby.hostUserId matches
// - This prevents random users from impersonating others within a lobby

import { Query } from "node-appwrite";

/**
 * Verifies that a userId corresponds to a real player in the given lobby.
 *
 * @param userId - The user's Appwrite $id (passed from client)
 * @param lobbyId - The lobby to check membership in
 * @returns The verified userId
 * @throws 400 if parameters missing, 403 if not a player in the lobby
 */
export async function verifyPlayerInLobby(
  userId: string,
  lobbyId: string,
): Promise<string> {
  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "userId is required for verification",
    });
  }
  if (!lobbyId) {
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required for verification",
    });
  }

  const { DB, PLAYER } = getCollectionIds();
  const databases = getAdminDatabases();

  const playersRes = await databases.listDocuments(DB, PLAYER, [
    Query.equal("userId", userId),
    Query.equal("lobbyId", lobbyId),
    Query.limit(1),
  ]);

  if (playersRes.total === 0) {
    throw createError({
      statusCode: 403,
      statusMessage: "You are not a player in this lobby",
    });
  }

  return userId;
}

/**
 * Verifies that a userId corresponds to the host of the given lobby.
 *
 * @param userId - The user's Appwrite $id (passed from client)
 * @param lobbyId - The lobby to check host status for
 * @returns The verified host userId
 * @throws 400, 403 if not authenticated or not the host
 */
export async function verifyHost(
  userId: string,
  lobbyId: string,
): Promise<string> {
  // First verify they're a player
  await verifyPlayerInLobby(userId, lobbyId);

  const { DB, LOBBY } = getCollectionIds();
  const databases = getAdminDatabases();

  const lobby = await databases.getDocument(DB, LOBBY, lobbyId);

  if (lobby.hostUserId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Only the host can perform this action",
    });
  }

  return userId;
}
