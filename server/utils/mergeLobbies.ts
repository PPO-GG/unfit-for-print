// server/utils/mergeLobbies.ts
// Pure function that merges Teleportal live docs with Appwrite lobby registry.
// Extracted for testability — called by the status.get.ts endpoint.

export interface UnifiedLobby {
  code: string;
  hasLiveDoc: boolean;
  hasRegistry: boolean;

  teleportal: {
    docId: string;
    clients: number;
    idleSec: number;
    phase: string | null;
    round: number | null;
    players: { id: string; name: string; avatar?: string; isBot?: boolean }[];
    meta: Record<string, any>;
  } | null;

  registry: {
    lobbyId: string;
    status: string;
    lobbyName: string | null;
    hostUserId: string;
    createdAt: string;
  } | null;
}

interface TeleportalDocDetails {
  clients: number;
  idleSec: number;
  players: { id: string; name: string; avatar?: string; isBot?: boolean }[];
  meta: Record<string, any>;
  phase?: string;
  round?: number;
}

/**
 * Extracts the lobby code from a namespaced Teleportal docId.
 * e.g., "lobby/lobby-ABCD" -> "ABCD"
 */
function extractCode(docId: string): string {
  const match = docId.match(/lobby-([A-Z0-9]+)$/i);
  return match ? match[1] : docId;
}

/**
 * Merges Teleportal live documents with Appwrite lobby registry and settings.
 *
 * @param teleportalDocs - The `documents` map from Teleportal /status response
 * @param appwriteLobbies - Array of Appwrite lobby documents (must have $id, code, status, hostUserId, $createdAt)
 * @param appwriteSettings - Array of Appwrite game settings documents (must have lobbyId, lobbyName)
 */
export function mergeLobbies(
  teleportalDocs: Record<string, TeleportalDocDetails>,
  appwriteLobbies: Array<Record<string, any>>,
  appwriteSettings: Array<Record<string, any>>,
): UnifiedLobby[] {
  // Build settings lookup: lobbyId -> lobbyName
  const settingsMap = new Map<string, string>();
  for (const s of appwriteSettings) {
    const lobbyId =
      typeof s.lobbyId === "object" && s.lobbyId?.$id
        ? s.lobbyId.$id
        : String(s.lobbyId);
    settingsMap.set(lobbyId, s.lobbyName ?? null);
  }

  // Build Appwrite lookup: code -> registry data
  const appwriteByCode = new Map<
    string,
    { lobbyId: string; status: string; lobbyName: string | null; hostUserId: string; createdAt: string }
  >();
  for (const lobby of appwriteLobbies) {
    appwriteByCode.set(lobby.code, {
      lobbyId: lobby.$id,
      status: lobby.status,
      lobbyName: settingsMap.get(lobby.$id) ?? null,
      hostUserId: lobby.hostUserId,
      createdAt: lobby.$createdAt,
    });
  }

  const matched = new Set<string>();
  const liveLobbies: UnifiedLobby[] = [];

  // Process Teleportal docs
  for (const [docId, details] of Object.entries(teleportalDocs)) {
    const code = extractCode(docId);
    const appwrite = appwriteByCode.get(code) ?? null;

    if (appwrite) matched.add(code);

    liveLobbies.push({
      code,
      hasLiveDoc: true,
      hasRegistry: !!appwrite,
      teleportal: {
        docId,
        clients: details.clients,
        idleSec: details.idleSec,
        phase: details.phase ?? null,
        round: details.round ?? null,
        players: details.players,
        meta: details.meta,
      },
      registry: appwrite,
    });
  }

  // Sort live lobbies: clients desc, then idleSec asc
  liveLobbies.sort((a, b) => {
    const ca = a.teleportal!.clients;
    const cb = b.teleportal!.clients;
    if (cb !== ca) return cb - ca;
    return a.teleportal!.idleSec - b.teleportal!.idleSec;
  });

  // Collect orphaned Appwrite lobbies (no live doc)
  const orphans: UnifiedLobby[] = [];
  for (const lobby of appwriteLobbies) {
    if (matched.has(lobby.code)) continue;
    orphans.push({
      code: lobby.code,
      hasLiveDoc: false,
      hasRegistry: true,
      teleportal: null,
      registry: {
        lobbyId: lobby.$id,
        status: lobby.status,
        lobbyName: settingsMap.get(lobby.$id) ?? null,
        hostUserId: lobby.hostUserId,
        createdAt: lobby.$createdAt,
      },
    });
  }

  // Sort orphans: createdAt desc
  orphans.sort((a, b) => {
    const da = new Date(a.registry!.createdAt).getTime();
    const db = new Date(b.registry!.createdAt).getTime();
    return db - da;
  });

  return [...liveLobbies, ...orphans];
}
