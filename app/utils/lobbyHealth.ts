// "Needs attention" rules for the admin lobby monitor. First match wins.
import type { LobbyIssue } from "~~/server/utils/lobbyIssues";
import type { UnifiedLobby } from "~~/server/utils/mergeLobbies";
import { isActivePhase, phaseInfo } from "./lobbyPhase";
import { isOnline, judgeName } from "./lobbyMonitorView";

/** No doc edits for this long mid-round reads as stuck. */
export const STALL_SEC = 180;
/** An offline judge is only flagged once the round has been quiet this long. */
export const JUDGE_GRACE_SEC = 60;

export interface LobbyHealth {
  level: "red" | "amber";
  reason: string;
}

export function lobbyHealth(
  lobby: UnifiedLobby,
  issues: LobbyIssue[],
  idleDocTtlSec: number,
): LobbyHealth | null {
  const t = lobby.teleportal;
  if (!t) return null;

  // Client errors are listed in the drawer but are too noisy to alarm on.
  const anomaly = issues.find((i) => i.kind === "anomaly");
  if (anomaly) return { level: "red", reason: `Watchdog: ${anomaly.title}` };

  const active = isActivePhase(t.phase);
  // Bots never open a socket, and an empty room has no presence to judge by
  // (it falls through to the "Nobody connected" rule below).
  const judgeIsBot = t.players.find((p) => p.id === t.judgeId)?.isBot === true;
  if (
    active && t.clients > 0 && t.judgeId && !judgeIsBot
    && t.idleSec >= JUDGE_GRACE_SEC && isOnline(lobby, t.judgeId) === false
  ) {
    return { level: "red", reason: `Judge ${judgeName(lobby) ?? "?"} is offline` };
  }
  if (active && t.clients > 0 && t.idleSec >= STALL_SEC) {
    const minutes = Math.floor(t.idleSec / 60);
    return { level: "red", reason: `No moves for ${minutes} min in ${phaseInfo(t.phase).label}` };
  }
  if (t.clients === 0) {
    const minutes = Math.max(0, Math.ceil((idleDocTtlSec - t.idleSec) / 60));
    return { level: "amber", reason: `Nobody connected · expires in about ${minutes} min` };
  }
  if (!lobby.hasRegistry) return { level: "amber", reason: "Live game with no database record" };
  return null;
}
