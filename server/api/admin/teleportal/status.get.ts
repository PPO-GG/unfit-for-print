// server/api/admin/teleportal/status.get.ts
// Fetches Teleportal /status and the Postgres lobby registry in parallel,
// merges them into a unified response for the admin lobby monitor.

import { desc } from "drizzle-orm";
import { createError } from "h3";
import { useDb } from "~/server/db/client";
import { lobbies } from "~/server/db/schema";
import { requireAdmin } from "~/server/utils/session";

export interface UnifiedStatusResponse {
  server: {
    version: string;
    uptime: number;
    activeClients: number;
    activeDocuments: number;
    idleDocTtlSec: number;
    memoryUsage: { rss: string; heapUsed: string };
  };
  lobbies: UnifiedLobby[];
}

export default defineEventHandler(async (event): Promise<UnifiedStatusResponse> => {
  await requireAdmin(event);

  const url = getTeleportalHttpUrl();
  const db = useDb();

  try {
    // Fetch both sources in parallel
    const [teleportal, lobbyRows] = await Promise.all([
      $fetch<any>(`${url}/status`),
      db.select().from(lobbies).orderBy(desc(lobbies.createdAt)).limit(500),
    ]);

    const unifiedLobbies = mergeLobbies(
      teleportal.documents ?? {},
      lobbyRows,
      // Game settings are now in Y.Doc — no separate table to query
      [],
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
    };
  } catch (err: any) {
    console.error("[admin/teleportal/status] Fetch failed:", err);
    throw createError({
      statusCode: 500,
      statusMessage: err?.message || "Failed to fetch lobby status",
    });
  }
});
