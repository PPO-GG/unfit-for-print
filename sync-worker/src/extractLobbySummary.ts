// Reads the fields the registry needs out of a lobby doc. Ported from
// getDocumentDetails in teleportal-server/src/server.ts — same fallbacks,
// same type guards — so /status and /lobbies/summary keep their meaning.

import type * as Y from "yjs";
import type { LobbyDocSummary, LobbyPlayer } from "./types";

export function extractLobbySummary(doc: Y.Doc): LobbyDocSummary {
  const players: LobbyPlayer[] = [];
  doc.getMap("players").forEach((value: unknown, key: string) => {
    try {
      const data: any = typeof value === "string" ? JSON.parse(value) : value;
      players.push({
        id: key,
        name: data?.name || data?.displayName || "Unknown",
        avatar: data?.avatar || data?.avatarUrl || undefined,
        isBot: data?.isBot || false,
      });
    } catch {
      players.push({ id: key, name: "Unknown" });
    }
  });

  const meta: Record<string, unknown> = {};
  doc.getMap("meta").forEach((value: unknown, key: string) => {
    meta[key] = value;
  });

  const settings = doc.getMap("settings");
  const gameState = doc.getMap("gameState");
  const status = meta.status;
  const lobbyName = settings.get("lobbyName");
  const isPrivate = settings.get("isPrivate");
  const phase = gameState.get("phase");
  const round = gameState.get("round");

  return {
    players,
    meta,
    status: typeof status === "string" ? status : undefined,
    lobbyName: typeof lobbyName === "string" ? lobbyName : undefined,
    isPrivate: typeof isPrivate === "boolean" ? isPrivate : undefined,
    phase: typeof phase === "string" ? phase : undefined,
    round: typeof round === "number" ? round : undefined,
  };
}
