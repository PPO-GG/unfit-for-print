// server/utils/requirePlayer.ts
// Validates that the caller has a valid Appwrite session and is a player in the given lobby.
// Returns the authenticated userId or throws a 401/403 error.
//
// Session discovery strategy:
//  1. Try the `x-appwrite-session` header (explicit, used by admin tools)
//  2. Fall back to the Appwrite session cookie (a_session_*)
//  3. Fall back to `Authorization: Bearer <jwt>` header

import { H3Event, createError, getHeader, parseCookies } from "h3";
import { Client, Account, Query } from "node-appwrite";

/**
 * Extracts the Appwrite session token from the request.
 * Looks in headers first, then falls back to cookies.
 */
function extractSession(event: H3Event): string | null {
  // 1. Explicit header
  const headerSession = getHeader(event, "x-appwrite-session");
  if (headerSession) return headerSession;

  // 2. Authorization bearer
  const authHeader = getHeader(event, "Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // 3. Appwrite session cookie (format: a_session_<projectId>)
  const cookies = parseCookies(event);
  const config = useRuntimeConfig();
  const projectId = config.public.appwriteProjectId as string;

  // Try the exact cookie name Appwrite uses
  const cookieName = `a_session_${projectId}`;
  if (cookies[cookieName]) return cookies[cookieName];

  // Try legacy format
  const legacyCookieName = `a_session_${projectId}_legacy`;
  if (cookies[legacyCookieName]) return cookies[legacyCookieName];

  return null;
}

/**
 * Validates the caller's identity via Appwrite session.
 *
 * @returns The authenticated user's ID
 * @throws 401 if no token or invalid session
 */
export async function requireAuth(event: H3Event): Promise<string> {
  const session = extractSession(event);

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required — no session found",
    });
  }

  const config = useRuntimeConfig();
  const client = new Client()
    .setEndpoint(config.public.appwriteEndpoint as string)
    .setProject(config.public.appwriteProjectId as string)
    .setSession(session);

  const account = new Account(client);

  try {
    const user = await account.get();
    return user.$id;
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid or expired session",
    });
  }
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
  const databases = getAdminDatabases();
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
