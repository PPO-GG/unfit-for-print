// server/utils/mergeLobbies.ts
// Pure function that merges the sync worker's live docs with the Postgres
// lobby registry. Extracted for testability — called by the status endpoint.

export type LobbySource = "discord" | "web";

export interface LobbyPlayerSummary {
  id: string;
  name: string;
  avatar?: string;
  isBot?: boolean;
  playerType?: string;
}

export interface UnifiedLobby {
  code: string;
  hasLiveDoc: boolean;
  hasRegistry: boolean;
  /** From the registry row (Discord instance id set or not); null without one. */
  source: LobbySource | null;

  teleportal: {
    docId: string;
    clients: number;
    idleSec: number;
    phase: string | null;
    round: number | null;
    players: LobbyPlayerSummary[];
    meta: Record<string, any>;
    lobbyName: string | null;
    isPrivate: boolean | null;
    hostUserId: string | null;
    judgeId: string | null;
    scores: Record<string, number>;
    maxPoints: number | null;
    submittedIds: string[];
    /** Null when the worker predates presence. */
    onlinePlayerIds: string[] | null;
    anonymousClients: number | null;
  } | null;

  registry: {
    lobbyId: string;
    status: string;
    lobbyName: string | null;
    hostUserId: string;
    createdAt: string;
    isPrivate: boolean;
  } | null;
}

interface TeleportalDocDetails {
  clients: number;
  idleSec: number;
  players: LobbyPlayerSummary[];
  meta: Record<string, any>;
  phase?: string;
  round?: number;
  lobbyName?: string;
  isPrivate?: boolean;
  hostUserId?: string;
  judgeId?: string;
  scores?: Record<string, number>;
  maxPoints?: number;
  submittedIds?: string[];
  onlinePlayerIds?: string[];
  anonymousClients?: number;
}

type RegistryEntry = NonNullable<UnifiedLobby["registry"]> & { source: LobbySource };

/**
 * Extracts the lobby code from a namespaced docId.
 * e.g., "lobby/lobby-ABCD" -> "ABCD"
 */
function extractCode(docId: string): string {
  const match = docId.match(/lobby-([A-Z0-9]+)$/i);
  return match && match[1] ? match[1] : docId;
}

function toTeleportal(docId: string, d: TeleportalDocDetails): NonNullable<UnifiedLobby["teleportal"]> {
  return {
    docId,
    clients: d.clients,
    idleSec: d.idleSec,
    phase: d.phase ?? null,
    round: d.round ?? null,
    players: d.players ?? [],
    meta: d.meta ?? {},
    lobbyName: d.lobbyName ?? null,
    isPrivate: d.isPrivate ?? null,
    hostUserId: d.hostUserId ?? null,
    judgeId: d.judgeId ?? null,
    scores: d.scores ?? {},
    maxPoints: d.maxPoints ?? null,
    submittedIds: d.submittedIds ?? [],
    onlinePlayerIds: d.onlinePlayerIds ?? null,
    anonymousClients: d.anonymousClients ?? null,
  };
}

/**
 * Merges live docs with the lobby registry and settings.
 *
 * @param teleportalDocs - The `documents` map from the worker's /status response
 * @param registryLobbies - Lobby rows (id, code, status, hostUserId, createdAt, discordInstanceId, isPrivate)
 * @param registrySettings - Settings rows (lobbyId, lobbyName); empty since settings moved into the doc
 */
export function mergeLobbies(
  teleportalDocs: Record<string, TeleportalDocDetails>,
  registryLobbies: Array<Record<string, any>>,
  registrySettings: Array<Record<string, any>>,
): UnifiedLobby[] {
  const settingsMap = new Map<string, string | null>();
  for (const s of registrySettings) {
    const lobbyId =
      typeof s.lobbyId === "object" && s.lobbyId?.id ? s.lobbyId.id : String(s.lobbyId);
    settingsMap.set(lobbyId, s.lobbyName ?? null);
  }

  const byCode = new Map<string, RegistryEntry>();
  for (const lobby of registryLobbies) {
    byCode.set(lobby.code, {
      lobbyId: lobby.id,
      status: lobby.status,
      lobbyName: settingsMap.get(lobby.id) ?? null,
      hostUserId: lobby.hostUserId,
      createdAt: lobby.createdAt,
      isPrivate: lobby.isPrivate === true,
      source: lobby.discordInstanceId ? "discord" : "web",
    });
  }

  const split = (entry: RegistryEntry | undefined) => {
    if (!entry) return { registry: null, source: null };
    const { source, ...registry } = entry;
    return { registry, source };
  };

  const matched = new Set<string>();
  const liveLobbies: UnifiedLobby[] = [];

  for (const [docId, details] of Object.entries(teleportalDocs)) {
    const code = extractCode(docId);
    const entry = byCode.get(code);
    if (entry) matched.add(code);
    liveLobbies.push({
      code,
      hasLiveDoc: true,
      hasRegistry: !!entry,
      ...split(entry),
      teleportal: toTeleportal(docId, details),
    });
  }

  // Sort live lobbies: clients desc, then idleSec asc
  liveLobbies.sort((a, b) => {
    const ca = a.teleportal!.clients;
    const cb = b.teleportal!.clients;
    if (cb !== ca) return cb - ca;
    return a.teleportal!.idleSec - b.teleportal!.idleSec;
  });

  const orphans: UnifiedLobby[] = [];
  for (const lobby of registryLobbies) {
    if (matched.has(lobby.code)) continue;
    orphans.push({
      code: lobby.code,
      hasLiveDoc: false,
      hasRegistry: true,
      ...split(byCode.get(lobby.code)),
      teleportal: null,
    });
  }

  orphans.sort(
    (a, b) => new Date(b.registry!.createdAt).getTime() - new Date(a.registry!.createdAt).getTime(),
  );

  return [...liveLobbies, ...orphans];
}
