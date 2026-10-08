// POST /api/lobby/activity-play
// The Discord Activity's one button. Everyone in an Activity instance plays
// the same game: the first press creates it (caller becomes host), every
// later press gets that lobby back and joins it client-side via joinLobby.
//
// Presses are serialised per instance with a transaction-scoped advisory lock,
// so two people tapping Play together get one lobby, not two. A lock rather
// than a unique index because prod may already hold duplicate instance ids
// from the old hub, which would fail the migration.

import { desc, eq, sql } from "drizzle-orm";
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
 * Whether a lobby's game is gone: the sync worker no longer holds its doc (it
 * drops one 10 minutes after the last client leaves). `liveCodes` null means
 * the sync worker was unreachable, which counts as alive, so an outage never
 * orphans a game.
 */
function isDead(
  lobby: { code: string; createdAt: Date },
  liveCodes: Set<string> | null,
): boolean {
  if (Date.now() - lobby.createdAt.getTime() < NEW_LOBBY_GRACE_MS) return false;
  if (liveCodes === null) return false;
  return !liveCodes.has(lobby.code.toUpperCase());
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

  // Fetched before taking the lock so a slow Teleportal never holds a pooled
  // connection. A stale answer is harmless: "absent" only matters past the
  // grace window, and a lobby created since is inside it.
  const live = await fetchLiveLobbies();
  // A doc with no status was never set up: its creator left before writing
  // it, so nobody can start that game and it counts as gone. Only builds that
  // report status (Teleportal since 2026-09) can say so; on an older one,
  // being held is all we know.
  const reportsStatus = !!live?.some((l) => typeof l?.status === "string");
  const liveCodes =
    live &&
    new Set(
      live
        .filter((l) => l?.code && (!reportsStatus || typeof l.status === "string"))
        .map((l) => l.code.toUpperCase()),
    );

  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${"activity:" + instanceId}))`,
    );

    const rows = await tx
      .select()
      .from(lobbies)
      .where(eq(lobbies.discordInstanceId, instanceId))
      .orderBy(desc(lobbies.createdAt))
      .limit(20);

    // A doc Teleportal still holds is where the group is, whatever the row
    // says: a finished game's row reads "complete" (reconciled from the doc)
    // while everyone is still on the podium or starting a rematch.
    const inPlay = liveCodes && rows.find((r) => liveCodes.has(r.code.toUpperCase()));
    if (inPlay) return { lobby: inPlay, created: false };

    const existing = rows.find((r) => r.status !== "complete");
    if (existing) {
      if (!isDead(existing, liveCodes)) return { lobby: existing, created: false };
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
