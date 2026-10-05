// POST /api/lobby/activity-play
// The Discord Activity's one button. Everyone in an Activity instance plays
// the same game: the first press creates it (caller becomes host), every
// later press gets that lobby back and joins it client-side via joinLobby.
//
// Presses are serialised per instance with a transaction-scoped advisory lock,
// so two people tapping Play together get one lobby, not two. A lock rather
// than a unique index because prod may already hold duplicate instance ids
// from the old hub, which would fail the migration.

import { and, desc, eq, ne, sql } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies, users } from "~~/server/db/schema";
import { recordActivity } from "~~/server/utils/activity";
import { createLobbyRow } from "~~/server/utils/createLobbyRow";
import { fetchLiveLobbies } from "~~/server/utils/reconcileLobbies";
import { requireNonGuest } from "~~/server/utils/session";

/**
 * A lobby younger than this is never judged dead: its creator inserted the
 * row but may not have connected the Y.Doc yet.
 */
const NEW_LOBBY_GRACE_MS = 30_000;

/**
 * Whether a lobby's game is gone: Teleportal no longer holds its doc (it drops
 * one 60 s after the last client leaves). Fails open — an unreachable
 * Teleportal means "alive", so an outage never orphans a running game.
 */
async function isDead(lobby: { code: string; createdAt: Date }): Promise<boolean> {
  if (Date.now() - lobby.createdAt.getTime() < NEW_LOBBY_GRACE_MS) return false;
  const live = await fetchLiveLobbies();
  if (live === null) return false;
  const code = lobby.code.toUpperCase();
  return !live.some((l) => l?.code?.toUpperCase() === code);
}

export default defineEventHandler(async (event) => {
  const userId = await requireNonGuest(event);
  const body = await readBody<{ instanceId?: string; channelId?: string }>(event);
  const instanceId = body?.instanceId?.trim();
  if (!instanceId) {
    throw createError({ statusCode: 400, statusMessage: "instanceId is required" });
  }

  const db = useDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw createError({ statusCode: 404, statusMessage: "User not found" });

  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${"activity:" + instanceId}))`,
    );

    const [existing] = await tx
      .select()
      .from(lobbies)
      .where(
        and(eq(lobbies.discordInstanceId, instanceId), ne(lobbies.status, "complete")),
      )
      .orderBy(desc(lobbies.createdAt))
      .limit(1);

    if (existing) {
      if (!(await isDead(existing))) return { lobby: existing, created: false };
      // pruneLobbies removes it later.
      await tx
        .update(lobbies)
        .set({ status: "complete" })
        .where(eq(lobbies.id, existing.id));
    }

    const lobby = await createLobbyRow(tx, user, {
      lobbyName: `${user.name}'s Game`,
      discordInstanceId: instanceId,
      discordChannelId: body.channelId,
      vcOnly: true,
      isPrivate: false,
    });
    return { lobby, created: true };
  });

  if (result.created) {
    await recordActivity("lobby_created", result.lobby.id, userId);
    await recordActivity("player_joined", result.lobby.id, userId);
  }
  return result;
});
