// server/api/admin/teleportal/status.get.ts
// Fetches Teleportal /status and the Postgres lobby registry in parallel,
// merges them into a unified response for the admin lobby monitor.

import { desc } from "drizzle-orm";
import { createError } from "h3";
import { useDb } from "~~/server/db/client";
import { lobbies } from "~~/server/db/schema";
import { openIssuesByLobby, type LobbyIssue } from "~~/server/utils/lobbyIssues";
import { buildHousekeeping, type Housekeeping } from "~~/server/utils/lobbyHousekeeping";
import type { UnifiedLobby } from "~~/server/utils/mergeLobbies";
import { requireAdmin } from "~~/server/utils/session";

export interface UnifiedStatusResponse {
  server: {
    version: string;
    /** Absent on the sync worker, which has no process uptime. */
    uptime?: number;
    activeClients: number;
    activeDocuments: number;
    idleDocTtlSec: number;
    /** Absent on the sync worker, which has no process memory to report. */
    memoryUsage?: { rss: string; heapUsed: string };
  };
  lobbies: UnifiedLobby[];
  /** Open issue groups with a recent event, keyed by lobby code. */
  issues: Record<string, LobbyIssue[]>;
  housekeeping: Housekeeping;
}

export default defineEventHandler(async (event): Promise<UnifiedStatusResponse> => {
  await requireAdmin(event);

  const url = getTeleportalHttpUrl();
  const db = useDb();

  try {
    // Fetch both sources in parallel
    const [teleportal, lobbyRows] = await Promise.all([
      $fetch<any>(`${url}/status`, { headers: teleportalAdminHeaders() }),
      db.select().from(lobbies).orderBy(desc(lobbies.createdAt)).limit(500),
    ]);

    const unifiedLobbies = mergeLobbies(
      teleportal.documents ?? {},
      lobbyRows,
      // Game settings are now in Y.Doc — no separate table to query
      [],
    );

    const issues = await openIssuesByLobby(
      db,
      unifiedLobbies.map((l) => l.code),
    );
    const housekeeping = buildHousekeeping(
      unifiedLobbies,
      Date.now(),
      teleportal.idleDocTtlSec ?? 600,
    );

    return {
      server: {
        version: teleportal.version,
        uptime: teleportal.uptime,
        activeClients: teleportal.activeClients,
        activeDocuments: teleportal.activeDocuments,
        idleDocTtlSec: teleportal.idleDocTtlSec,
        memoryUsage: teleportal.memoryUsage,
      },
      lobbies: unifiedLobbies,
      issues,
      housekeeping,
    };
  } catch (err: any) {
    console.error("[admin/teleportal/status] Fetch failed:", err);
    throw createError({
      statusCode: 500,
      statusMessage: err?.message || "Failed to fetch lobby status",
    });
  }
});
