import { and, countDistinct, eq, gte, lt } from "drizzle-orm";
import type { H3Event } from "h3";
import { useDb } from "../db/client";
import { activityEvents } from "../db/schema";

const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ActivityKind = (typeof activityEvents.$inferInsert)["kind"];
export type ActivitySource = "web" | "discord";

export interface SourceSplit {
  web: number;
  discord: number;
  /** Rows recorded before the source column existed. */
  unknown: number;
}

export interface ActivityStats {
  windowHours: number;
  lobbiesCreated: number;
  uniquePlayers: number;
  lobbiesBySource: SourceSplit;
  /** A user seen from both web and Discord counts once in each. */
  playersBySource: SourceSplit;
}

/**
 * Whether a request came from the Discord Activity. Its client authenticates
 * with a Bearer token (requireAuth has already verified it by the time this
 * runs); the website uses the session cookie. Reads the raw node headers
 * rather than h3's getHeader so route tests can pass a bare event.
 */
export function requestSource(event: H3Event): ActivitySource {
  const headers = (event as { node?: { req?: { headers?: Record<string, unknown> } } })
    ?.node?.req?.headers;
  const auth = headers?.authorization;
  return typeof auth === "string" && auth.startsWith("Bearer ") ? "discord" : "web";
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
  source: ActivitySource,
): Promise<void> {
  try {
    await useDb().insert(activityEvents).values({ kind, lobbyId, userId, source });
  } catch (err: any) {
    console.warn("[activity] Failed to record", kind, err?.message || err);
  }
}

function split(rows: { source: string | null; n: number }[]): SourceSplit {
  const result: SourceSplit = { web: 0, discord: 0, unknown: 0 };
  for (const row of rows) {
    const key = row.source === "web" || row.source === "discord" ? row.source : "unknown";
    result[key] += Number(row.n);
  }
  return result;
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
  const inWindow = (kind: ActivityKind) =>
    and(eq(activityEvents.kind, kind), gte(activityEvents.createdAt, since));

  const [[lobbiesRow], [playersRow], lobbySources, playerSources] = await Promise.all([
    db.select({ n: countDistinct(activityEvents.lobbyId) }).from(activityEvents).where(inWindow("lobby_created")),
    db.select({ n: countDistinct(activityEvents.userId) }).from(activityEvents).where(inWindow("player_joined")),
    db
      .select({ source: activityEvents.source, n: countDistinct(activityEvents.lobbyId) })
      .from(activityEvents)
      .where(inWindow("lobby_created"))
      .groupBy(activityEvents.source),
    db
      .select({ source: activityEvents.source, n: countDistinct(activityEvents.userId) })
      .from(activityEvents)
      .where(inWindow("player_joined"))
      .groupBy(activityEvents.source),
  ]);

  return {
    windowHours: Math.round(windowMs / (60 * 60 * 1000)),
    lobbiesCreated: lobbiesRow?.n ?? 0,
    uniquePlayers: playersRow?.n ?? 0,
    lobbiesBySource: split(lobbySources),
    playersBySource: split(playerSources),
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
