// server/api/admin/teleportal/status.get.ts
// Fetches Teleportal /status and Appwrite lobby registry in parallel,
// merges them into a unified response for the admin lobby monitor.

import { Query } from "node-appwrite";
import { createError } from "h3";

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
  await assertAdmin(event);

  const url = getTeleportalHttpUrl();
  const { databases } = useAppwriteAdmin();
  const config = useRuntimeConfig();

  const DB_ID = config.public.appwriteDatabaseId as string;
  const LOBBY_COL = config.public.appwriteLobbyCollectionId as string;

  try {
    // Fetch both sources in parallel
    const [teleportal, lobbiesRes] = await Promise.all([
      $fetch<any>(`${url}/status`),
      databases.listDocuments(DB_ID, LOBBY_COL, [
        Query.orderDesc("$createdAt"),
        Query.limit(500),
      ]),
    ]);

    const lobbies = mergeLobbies(
      teleportal.documents ?? {},
      lobbiesRes.documents,
      // Game settings are now in Y.Doc — no Appwrite collection to query
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
      lobbies,
    };
  } catch (err: any) {
    console.error("[admin/teleportal/status] Fetch failed:", err);
    throw createError({
      statusCode: 500,
      statusMessage: err?.message || "Failed to fetch lobby status",
    });
  }
});
