export interface LobbyPlayer {
  id: string;
  name: string;
  avatar?: string;
  isBot?: boolean;
  /** "player" | "spectator" | "bot" as written by the client; absent on old docs. */
  playerType?: string;
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
  hostUserId?: string;
  judgeId?: string;
  /** Player id → points. Absent when the doc has none or it is unreadable. */
  scores?: Record<string, number>;
  /** Points needed to win (settings.maxPoints). */
  maxPoints?: number;
  /** Players with a play on the table this round. */
  submittedIds: string[];
}

/** One registry row: the doc summary plus the room's connection state. */
export interface LobbyRecord extends LobbyDocSummary {
  code: string;
  clients: number;
  lastActivity: number;
}
