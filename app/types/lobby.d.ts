// types/lobby.ts
// Represents the minimal Appwrite lobby document used for discovery.
// All game state lives in the Y.Doc (Teleportal); this is registry-only.
import type { Models } from "appwrite";

export interface Lobby extends Models.Row {
  code: string;
  hostUserId: string;
  status: "waiting" | "playing" | "complete";
}
