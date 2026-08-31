// server/utils/pruneLobbies.ts
// Utility to garbage-collect orphaned and completed lobbies from Postgres.
// - Orphaned lobbies: Not connected to Teleportal and older than 2 hours.
// - Completed lobbies: Marked status="complete" and older than 24 hours.

import { and, eq, inArray, isNull, lte, ne, notInArray } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies, players, users } from "~~/server/db/schema";
import { getTeleportalHttpUrl } from "~~/server/utils/teleportal";

export interface PruneLobbiesOptions {
  /** TTL for orphaned lobbies without a live Teleportal doc. Defaults to 2 hours. */
  orphanTtlMs?: number;
  /** TTL for completed lobbies. Defaults to 24 hours. */
  completedTtlMs?: number;
  /** Force prune all orphaned lobbies regardless of age. */
  forceAllOrphans?: boolean;
}

export interface PruneLobbiesResult {
  success: boolean;
  prunedCount: number;
  orphanedCount: number;
  completedCount: number;
  liveCount: number;
  teleportalOnline: boolean;
}

const DEFAULT_ORPHAN_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const DEFAULT_COMPLETED_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const GUEST_ORPHAN_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Extracts the 4-character lobby code from a Teleportal document key.
 * e.g., "lobby/lobby-ABCD" -> "ABCD" or "lobby-ABCD" -> "ABCD"
 */
function extractLobbyCode(docId: string): string {
  const match = docId.match(/lobby-([A-Z0-9]+)$/i);
  return match && match[1] ? match[1].toUpperCase() : docId.toUpperCase();
}

/**
 * Prunes stale lobbies (orphans older than 2h and completed older than 24h) from the database.
 */
export async function pruneStaleLobbies(
  options: PruneLobbiesOptions = {},
): Promise<PruneLobbiesResult> {
  const orphanTtl = options.orphanTtlMs ?? DEFAULT_ORPHAN_TTL_MS;
  const completedTtl = options.completedTtlMs ?? DEFAULT_COMPLETED_TTL_MS;
  const now = Date.now();

  const orphanCutoff = new Date(now - orphanTtl);
  const completedCutoff = new Date(now - completedTtl);
  const guestOrphanCutoff = new Date(now - GUEST_ORPHAN_TTL_MS);

  const db = useDb();

  // 1. Fetch live document IDs from Teleportal
  let teleportalOnline = false;
  const liveCodes = new Set<string>();

  try {
    const url = getTeleportalHttpUrl();
    const teleportal = await $fetch<{
      documents?: Record<string, any>;
    }>(`${url}/status`, { timeout: 4000 });

    teleportalOnline = true;
    if (teleportal.documents) {
      for (const docId of Object.keys(teleportal.documents)) {
        liveCodes.add(extractLobbyCode(docId));
      }
    }
  } catch (err: any) {
    console.warn(
      "[pruneLobbies] Could not connect to Teleportal status endpoint:",
      err?.message || err,
    );
  }

  // 2. Query all database lobbies
  const allLobbies = await db.select().from(lobbies);

  const candidateOrphanIds: string[] = [];
  const candidateCompletedIds: string[] = [];

  for (const lobby of allLobbies) {
    const createdAtTime = new Date(lobby.createdAt).getTime();

    // Completed lobby check: TTL of 24h
    if (lobby.status === "complete") {
      if (createdAtTime <= completedCutoff.getTime()) {
        candidateCompletedIds.push(lobby.id);
      }
      continue;
    }

    // Orphan check: If Teleportal is unreachable, do not prune orphans unless forceAllOrphans is set
    if (!teleportalOnline && !options.forceAllOrphans) {
      continue;
    }

    // If lobby code is live in Teleportal, never prune
    if (liveCodes.has(lobby.code.toUpperCase())) {
      continue;
    }

    // Orphaned: no live Teleportal doc
    const isOrphanExpired =
      options.forceAllOrphans || createdAtTime <= orphanCutoff.getTime();
    if (isOrphanExpired) {
      candidateOrphanIds.push(lobby.id);
    }
  }

  const candidateIds = [...candidateOrphanIds, ...candidateCompletedIds];

  if (candidateIds.length > 0) {
    // 3. Find guest/bot users to clean up from candidate lobbies
    const candidatePlayers = await db
      .select({ userId: players.userId })
      .from(players)
      .where(inArray(players.lobbyId, candidateIds));

    // 4. Delete the lobbies (cascades to players)
    await db.delete(lobbies).where(inArray(lobbies.id, candidateIds));

    // 5. Clean up ephemeral guest user accounts
    if (candidatePlayers.length > 0) {
      const candidateUserIds = Array.from(
        new Set(candidatePlayers.map((p) => p.userId)),
      );
      await db
        .delete(users)
        .where(
          and(
            inArray(users.id, candidateUserIds),
            eq(users.isGuest, true),
            isNull(users.discordUserId),
          ),
        );
    }
  }

  // 6. Clean up any orphaned guest users not participating in any remaining lobby
  const remainingPlayers = await db
    .select({ userId: players.userId })
    .from(players);
  const activeUserIds = Array.from(
    new Set(remainingPlayers.map((p) => p.userId)),
  );

  if (activeUserIds.length > 0) {
    await db
      .delete(users)
      .where(
        and(
          eq(users.isGuest, true),
          isNull(users.discordUserId),
          lte(users.createdAt, guestOrphanCutoff),
          notInArray(users.id, activeUserIds),
        ),
      );
  } else {
    await db
      .delete(users)
      .where(
        and(
          eq(users.isGuest, true),
          isNull(users.discordUserId),
          lte(users.createdAt, guestOrphanCutoff),
        ),
      );
  }

  return {
    success: true,
    prunedCount: candidateIds.length,
    orphanedCount: candidateOrphanIds.length,
    completedCount: candidateCompletedIds.length,
    liveCount: liveCodes.size,
    teleportalOnline,
  };
}

