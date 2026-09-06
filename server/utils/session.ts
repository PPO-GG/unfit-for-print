import { and, eq } from "drizzle-orm";
import { createError, getHeader, type H3Event } from "h3";
import { useDb } from "../db/client";
import { lobbies, players, users } from "../db/schema";
import { verifyActivityToken } from "./activityToken";

/** Resolves the authenticated user from an Activity token or Nuxt session. */
export async function requireAuth(event: H3Event): Promise<string> {
  const authHeader = getHeader(event, "Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const payload = verifyActivityToken(authHeader.slice(7));
    if (!payload) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid or expired token",
      });
    }
    return assertUserExists(payload.userId);
  }

  const session = await getUserSession(event);
  // nuxt-auth-utils types `User` as an empty interface for apps to augment;
  // this project stores an id on it. Narrowed once here rather than at each use.
  const sessionUserId = (session.user as { id?: string } | undefined)?.id;
  if (!sessionUserId) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required",
    });
  }
  return assertUserExists(sessionUserId);
}

/**
 * A session can outlive the account it names: leaving a lobby deletes an
 * ephemeral guest, and the cookie survives. Without this the dead id flows on
 * into inserts and fails a foreign key deep in the database — the caller sees a
 * 500 on an action that was never going to work, instead of a 401 telling them
 * to sign in again.
 */
async function assertUserExists(userId: string): Promise<string> {
  const [user] = await useDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Session is no longer valid",
    });
  }
  return userId;
}

/** Ensures the authenticated user is a player in the specified lobby. */
export async function requirePlayerInLobby(
  event: H3Event,
  lobbyId: string,
): Promise<string> {
  const userId = await requireAuth(event);
  const db = useDb();

  const [row] = await db
    .select({ id: players.id })
    .from(players)
    .where(and(eq(players.userId, userId), eq(players.lobbyId, lobbyId)))
    .limit(1);

  if (!row) {
    throw createError({
      statusCode: 403,
      statusMessage: "You are not a player in this lobby",
    });
  }
  return userId;
}

/** Ensures the authenticated player owns the specified lobby. */
export async function requireHost(
  event: H3Event,
  lobbyId: string,
): Promise<string> {
  const userId = await requirePlayerInLobby(event, lobbyId);
  const db = useDb();

  const [lobby] = await db
    .select({ hostUserId: lobbies.hostUserId })
    .from(lobbies)
    .where(eq(lobbies.id, lobbyId))
    .limit(1);

  if (!lobby || lobby.hostUserId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Only the host can perform this action",
    });
  }
  return userId;
}

/**
 * Ensures the caller holds a real account rather than a guest session.
 *
 * Guests are minted by POST /api/auth/guest with nothing but a username, so a
 * guest session proves nothing about who is calling. Anything that creates
 * durable state someone else has to live with — a lobby, for one — needs this
 * rather than bare `requireAuth`, which accepts guest and Discord sessions
 * alike. The UI already disables those actions for guests; this is the half
 * that a client cannot skip.
 */
export async function requireNonGuest(event: H3Event): Promise<string> {
  const userId = await requireAuth(event);
  const db = useDb();

  const [user] = await db
    .select({ isGuest: users.isGuest })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.isGuest) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden: sign in to do this",
    });
  }
  return userId;
}

/** Ensures the authenticated user is currently an admin. */
export async function requireAdmin(event: H3Event): Promise<string> {
  const userId = await requireAuth(event);
  const db = useDb();

  const [user] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden: admin access required",
    });
  }
  return userId;
}
