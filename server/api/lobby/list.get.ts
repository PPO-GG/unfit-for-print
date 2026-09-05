import { inArray, ne, desc, and, eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies } from "~~/server/db/schema";
import { getTeleportalHttpUrl } from "~~/server/utils/teleportal";
import {
  planLobbyReconciliation,
  type LiveLobbySummary,
} from "~~/server/utils/reconcileLobbies";

/** Teleportal is a side service; never let it hold up the lobby browser. */
const SUMMARY_TIMEOUT_MS = 2000;

/**
 * Pulls the authoritative lobby state out of the live Y.Docs and writes back
 * anything Postgres has wrong.
 *
 * The Y.Doc is the source of truth, but this table is what the public browser
 * filters on — and its mirrors used to be written by watchers running only in
 * the HOST's browser tab, so a host closing their tab stranded a lobby as
 * "playing" until the sweeper pruned it hours later.
 *
 * Fails open: a slightly stale browser beats an error because a side service
 * is down.
 */
async function reconcileAgainstLiveDocs(): Promise<void> {
  const db = useDb();

  let live: LiveLobbySummary[] = [];
  try {
    const summary = await $fetch<{ lobbies?: LiveLobbySummary[] }>(
      `${getTeleportalHttpUrl()}/lobbies/summary`,
      { timeout: SUMMARY_TIMEOUT_MS },
    );
    live = summary?.lobbies ?? [];
  } catch (err: any) {
    console.warn(
      "[lobby/list] Could not reach Teleportal for reconciliation:",
      err?.message || err,
    );
    return;
  }
  if (live.length === 0) return;

  const rows = await db
    .select({
      id: lobbies.id,
      code: lobbies.code,
      status: lobbies.status,
      lobbyName: lobbies.lobbyName,
      isPrivate: lobbies.isPrivate,
    })
    .from(lobbies);

  for (const { id, updates } of planLobbyReconciliation(rows, live)) {
    try {
      await db.update(lobbies).set(updates).where(eq(lobbies.id, id));
    } catch (err: any) {
      console.warn(
        `[lobby/list] Failed to reconcile lobby ${id}:`,
        err?.message || err,
      );
    }
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const db = useDb();
  const statuses = ((query.status as string) ?? "waiting,playing")
    .split(",")
    .map((s) => s.trim()) as ("waiting" | "playing" | "complete")[];

  // Correct drifted rows first, so the filters below run on current data.
  await reconcileAgainstLiveDocs();

  return db
    .select()
    .from(lobbies)
    .where(
      and(
        inArray(lobbies.status, statuses),
        ne(lobbies.vcOnly, true),
        ne(lobbies.isPrivate, true),
      ),
    )
    .orderBy(desc(lobbies.createdAt))
    .limit(100);
});
