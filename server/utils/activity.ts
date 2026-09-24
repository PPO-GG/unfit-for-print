import { and, countDistinct, eq, gte, lt } from "drizzle-orm";
import { useDb } from "../db/client";
import { activityEvents } from "../db/schema";

const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ActivityKind = (typeof activityEvents.$inferInsert)["kind"];

export interface ActivityStats {
  windowHours: number;
  lobbiesCreated: number;
  uniquePlayers: number;
}

/**
 * Logs one activity row. Never throws: this is bookkeeping for an admin
 * counter, and a failed insert must not turn a lobby create or join into a
 * 500 for the player.
 */
export async function recordActivity(
  kind: ActivityKind,
  lobbyId: string,
  userId: string,
): Promise<void> {
  try {
    await useDb().insert(activityEvents).values({ kind, lobbyId, userId });
  } catch (err: any) {
    console.warn("[activity] Failed to record", kind, err?.message || err);
  }
}

/**
 * Lobbies created and distinct players seated in the trailing window. Hosts
 * count as players — lobby/create logs a join for them too. A guest who
 * leaves and comes back gets a fresh guest account, so they count twice;
 * signed-in users are counted once.
 */
export async function getActivityStats(windowMs = DAY_MS): Promise<ActivityStats> {
  const db = useDb();
  const since = new Date(Date.now() - windowMs);

  const [[lobbiesRow], [playersRow]] = await Promise.all([
    db
      .select({ n: countDistinct(activityEvents.lobbyId) })
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.kind, "lobby_created"),
          gte(activityEvents.createdAt, since),
        ),
      ),
    db
      .select({ n: countDistinct(activityEvents.userId) })
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.kind, "player_joined"),
          gte(activityEvents.createdAt, since),
        ),
      ),
  ]);

  return {
    windowHours: Math.round(windowMs / (60 * 60 * 1000)),
    lobbiesCreated: lobbiesRow?.n ?? 0,
    uniquePlayers: playersRow?.n ?? 0,
  };
}

export async function pruneActivity(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * DAY_MS);
  const deleted = await useDb()
    .delete(activityEvents)
    .where(lt(activityEvents.createdAt, cutoff))
    .returning({ id: activityEvents.id });
  return deleted.length;
}
