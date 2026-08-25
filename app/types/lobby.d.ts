// types/lobby.ts
// Represents the lobby registry row (Drizzle/Postgres). All game state
// lives in the Y.Doc (Teleportal); this is registry-only.
export interface Lobby {
  id: string;
  code: string;
  hostUserId: string;
  status: "waiting" | "playing" | "complete";
  lobbyName?: string | null;
  discordInstanceId?: string | null;
  discordChannelId?: string | null;
  vcOnly?: boolean;
  createdAt: string;
}
