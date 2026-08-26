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
    return payload.userId;
  }

  const session = await getUserSession(event);
  if (!session.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required",
    });
  }
  return session.user.id;
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
