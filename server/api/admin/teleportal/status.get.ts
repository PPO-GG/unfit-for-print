// server/api/admin/teleportal/status.get.ts
// Fetches Teleportal /status and Appwrite lobby registry in parallel,
// merges them into a unified response for the admin lobby monitor.

import { Query } from "node-appwrite";

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
  const GAMESETTINGS_COL = config.public.appwriteGameSettingsCollectionId as string;

  // Fetch all three sources in parallel
  const [teleportal, lobbiesRes, settingsRes] = await Promise.all([
    $fetch<any>(`${url}/status`),
    databases.listDocuments(DB_ID, LOBBY_COL, [
      Query.orderDesc("$createdAt"),
      Query.limit(500),
    ]),
    databases.listDocuments(DB_ID, GAMESETTINGS_COL, [
      Query.limit(500),
    ]),
  ]);

  const lobbies = mergeLobbies(
    teleportal.documents ?? {},
    lobbiesRes.documents,
    settingsRes.documents,
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
});
