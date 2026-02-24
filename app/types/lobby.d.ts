// types/lobby.ts
import type { Models } from "appwrite";

export interface Lobby extends Models.Row {
  code: string;
  hostUserId: string;
  players: string[];
  status: "waiting" | "playing" | "complete";
  round: number;
  gameState: string;
  roundEndCountdownDuration: number; // Host-configurable countdown duration (seconds)
  revealedSubmissions?: Record<string, boolean> | string;
}
