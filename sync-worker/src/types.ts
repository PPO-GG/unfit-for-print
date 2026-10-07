export interface LobbyPlayer {
  id: string;
  name: string;
  avatar?: string;
  isBot?: boolean;
}

/** What a room reads out of its own doc for the registry. */
export interface LobbyDocSummary {
  players: LobbyPlayer[];
  /** The whole meta map, raw — the admin monitor reads `hostName` from it. */
  meta: Record<string, unknown>;
  status?: string;
  lobbyName?: string;
  isPrivate?: boolean;
  phase?: string;
  round?: number;
}

/** One registry row: the doc summary plus the room's connection state. */
export interface LobbyRecord extends LobbyDocSummary {
  code: string;
  clients: number;
  lastActivity: number;
}
