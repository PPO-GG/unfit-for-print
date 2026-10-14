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
      const playerType = typeof data?.playerType === "string" ? data.playerType : undefined;
      players.push({
        id: key,
        name: data?.name || data?.displayName || "Unknown",
        avatar: data?.avatar || data?.avatarUrl || undefined,
        // Bots are written with playerType/provider "bot"; `isBot` is only a
        // fallback for docs that predate that.
        isBot: data?.isBot === true || playerType === "bot" || data?.provider === "bot",
        playerType,
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
  const hostUserId = meta.hostUserId;
  const lobbyName = settings.get("lobbyName");
  const isPrivate = settings.get("isPrivate");
  const maxPoints = settings.get("maxPoints");
  const phase = gameState.get("phase");
  const round = gameState.get("round");
  const judgeId = gameState.get("judgeId");

  return {
    players,
    meta,
    status: typeof status === "string" ? status : undefined,
    lobbyName: typeof lobbyName === "string" ? lobbyName : undefined,
    isPrivate: typeof isPrivate === "boolean" ? isPrivate : undefined,
    phase: typeof phase === "string" ? phase : undefined,
    round: typeof round === "number" ? round : undefined,
    hostUserId: typeof hostUserId === "string" ? hostUserId : undefined,
    judgeId: typeof judgeId === "string" && judgeId ? judgeId : undefined,
    scores: readScores(gameState.get("scores")),
    maxPoints: typeof maxPoints === "number" ? maxPoints : undefined,
    submittedIds: readSubmittedIds(doc),
  };
}

function parseJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function readScores(raw: unknown): Record<string, number> | undefined {
  const parsed = parseJson(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const scores: Record<string, number> = {};
  for (const [id, value] of Object.entries(parsed)) {
    if (typeof value === "number" && Number.isFinite(value)) scores[id] = value;
  }
  return scores;
}

function isNonEmptyPlay(raw: unknown): boolean {
  const parsed = parseJson(raw);
  return Array.isArray(parsed) && parsed.length > 0;
}

/**
 * The worker's copy of app/utils/submissions.ts' merge: the per-player
 * `submissions` map over the retired `gameState.submissions` blob, which a
 * game in flight across the deploy may still use. Ids only.
 */
function readSubmittedIds(doc: Y.Doc): string[] {
  const ids = new Set<string>();
  const legacy = parseJson(doc.getMap("gameState").get("submissions"));
  if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
    for (const [id, play] of Object.entries(legacy)) {
      if (Array.isArray(play) && play.length > 0) ids.add(id);
    }
  }
  doc.getMap("submissions").forEach((value: unknown, key: string) => {
    if (isNonEmptyPlay(value)) ids.add(key);
  });
  return [...ids];
}
