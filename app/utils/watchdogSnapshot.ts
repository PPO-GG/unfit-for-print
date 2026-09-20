import type { useLobbyReactive } from "~/composables/useLobbyReactive";
import { WATCHDOG_RULES, type WatchdogSnapshot } from "~/utils/watchdogRules";

type LobbyReactive = ReturnType<typeof useLobbyReactive>;

/**
 * The watchdog's view of a live game, built from the reactive layer.
 *
 * Extracted because two callers need it and a second hand-rolled copy is how
 * this codebase has repeatedly ended up with two answers to one question —
 * the merge in `cardTexts`, the submissions read in `skipPlayer`, the chunked
 * deck in `parseCards`. `useGameWatchdog` evaluates it on a timer to report
 * anomalies; `useLobby` evaluates it once per bug report so every report says
 * which rules were detecting at the time.
 *
 * Card ids never leave the client — only how many each player holds.
 */
export function buildWatchdogSnapshot(
  reactive: LobbyReactive,
): WatchdogSnapshot | null {
  const gs = reactive.gameState.value;
  if (!gs) return null;

  // playerList carries spectators too; the engine counts only non-spectators
  // as players, so the rules have to use the same definition or
  // too-few-players and judge-missing both read the wrong roster.
  const activePlayerIds = (reactive.playerList.value ?? [])
    .filter((p) => p.playerType !== "spectator")
    .map((p) => p.$id);

  const handSizes = Object.fromEntries(
    Object.entries(reactive.hands.value ?? {}).map(([playerId, hand]) => [
      playerId,
      Array.isArray(hand) ? hand.length : 0,
    ]),
  );

  return {
    phase: gs.phase,
    judgeId: gs.judgeId ?? null,
    activePlayerIds,
    submittedPlayerIds: Object.keys(gs.submissions ?? {}),
    skippedPlayerIds: Array.isArray(gs.skippedPlayers) ? gs.skippedPlayers : [],
    handSizes,
    cardsPerPlayer: reactive.settings.value?.cardsPerPlayer ?? 10,
  };
}

/**
 * Which rules a snapshot trips right now.
 *
 * Instantaneous detection, not a firing: the watchdog additionally requires a
 * rule to hold continuously past its threshold before it reports one. A report
 * carrying `judging-empty` therefore means "this was true the moment the
 * player hit report", which is exactly what a human message like "cards stuck"
 * fails to say on its own.
 */
export function detectingRuleIds(snapshot: WatchdogSnapshot): string[] {
  return WATCHDOG_RULES.filter((r) => r.detect(snapshot)).map((r) => r.id);
}
