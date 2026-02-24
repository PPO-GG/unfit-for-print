// server/utils/requirePlayer.ts
// Validates that the caller has a valid Appwrite session and is a player in the given lobby.
// Returns the authenticated userId or throws a 401/403 error.
//
// Session discovery strategy (matches nuxt-appwrite's useAppwriteSession):
//  1. Try `Authorization: Bearer <sessionId>` header
//  2. Try the `x-appwrite-session` header (explicit)
//  3. Fall back to the Appwrite session cookie (a_session_*)
//
// Verification:
//  Uses the admin SDK (Users.get + Users.listSessions) to verify the session
//  server-side. This avoids cross-domain cookie issues since the client
//  explicitly sends sessionId + userId in headers.

import { H3Event, createError, getHeader, parseCookies } from "h3";
import { Query } from "node-appwrite";

/**
 * Extracts the Appwrite session ID and user ID from the request.
 * Mirrors nuxt-appwrite's _extractSessionCredentials logic.
 */
function extractSessionCredentials(event: H3Event): {
  sessionId: string | null;
  userId: string | null;
} {
  let sessionId: string | null = null;

  // 1. Authorization bearer header
  const authHeader = getHeader(event, "Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    sessionId = authHeader.slice(7);
  }

  // 2. Explicit x-appwrite-session header
  if (!sessionId) {
    sessionId = getHeader(event, "x-appwrite-session") ?? null;
  }

  // 3. Appwrite session cookie (format: a_session_<projectId>)
  if (!sessionId) {
    const cookies = parseCookies(event);
    const config = useRuntimeConfig();
    const projectId = config.public.appwriteProjectId as string;

    const cookieName = `a_session_${projectId}`;
    sessionId = cookies[cookieName] ?? null;

    if (!sessionId) {
      const legacyCookieName = `a_session_${projectId}_legacy`;
      sessionId = cookies[legacyCookieName] ?? null;
    }
  }

  // User ID from explicit header
  const userId = getHeader(event, "x-appwrite-user-id") ?? null;

  return { sessionId, userId };
}

/**
 * Validates the caller's identity via admin SDK session lookup.
 *
 * Uses the same verification pattern as nuxt-appwrite's useAppwriteSession:
 *  1. Extract sessionId + userId from headers/cookies
 *  2. Verify user exists via admin Users API
 *  3. Verify session exists, belongs to user, and hasn't expired
 *
 * @returns The authenticated user's ID
 * @throws 401 if no credentials or invalid/expired session
 */
export async function requireAuth(event: H3Event): Promise<string> {
  const { sessionId, userId } = extractSessionCredentials(event);

  if (!sessionId || !userId) {
    throw createError({
      statusCode: 401,
      statusMessage:
        "Authentication required — no session found. Send Authorization and x-appwrite-user-id headers.",
    });
  }

  // Verify via admin SDK (same as useAppwriteSession)
  const { users } = useAppwriteAdmin();

  // 1. Verify user exists
  try {
    await users.get({ userId });
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid user",
    });
  }

  // 2. Verify session exists and is not expired
  try {
    const sessions = await users.listSessions({ userId });
    const validSession = sessions.sessions.find(
      (s: any) => s.$id === sessionId,
    );
    if (!validSession) {
      throw new Error("Session not found");
    }
    const expiry = new Date(validSession.expire).getTime();
    if (expiry < Date.now()) {
      throw new Error("Session expired");
    }
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid or expired session",
    });
  }

  return userId;
}

/**
 * Validates that the caller is a participant (player or spectator) in the given lobby.
 *
 * @returns The authenticated player's userId
 * @throws 401 if not authenticated, 403 if not in the lobby
 */
export async function requirePlayerInLobby(
  event: H3Event,
  lobbyId: string,
): Promise<string> {
  const userId = await requireAuth(event);

  const { DB, PLAYER } = getCollectionIds();
  const tables = getAdminTables();

  const playersRes = await tables.listRows({
    databaseId: DB,
    tableId: PLAYER,
    queries: [
      Query.equal("userId", userId),
      Query.equal("lobbyId", lobbyId),
      Query.limit(1),
    ],
  });

  if (playersRes.total === 0) {
    throw createError({
      statusCode: 403,
      statusMessage: "You are not a player in this lobby",
    });
  }

  return userId;
}

/**
 * Validates that the caller is the host of the given lobby.
 *
 * @returns The authenticated host's userId
 * @throws 401, 403 if not authenticated or not the host
 */
export async function requireHost(
  event: H3Event,
  lobbyId: string,
): Promise<string> {
  const userId = await requirePlayerInLobby(event, lobbyId);

  const { DB, LOBBY } = getCollectionIds();
  const tables = getAdminTables();

  const lobby = await tables.getRow({
    databaseId: DB,
    tableId: LOBBY,
    rowId: lobbyId,
  });

  if (lobby.hostUserId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Only the host can perform this action",
    });
  }

  return userId;
}
