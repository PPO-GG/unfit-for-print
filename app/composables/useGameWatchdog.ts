import { useIntervalFn } from "@vueuse/core";
import type { useLobbyReactive } from "~/composables/useLobbyReactive";
import { useIssueReporter } from "~/composables/useIssueReporter";
import {
  WATCHDOG_RULES,
  evaluateRules,
  type WatchdogSnapshot,
  type WatchdogState,
} from "~/utils/watchdogRules";

/** Slow on purpose. Every rule's threshold is 10s or more, so a faster tick
 *  would only burn work to reach the same conclusions later. */
const TICK_MS = 15_000;

type LobbyReactive = ReturnType<typeof useLobbyReactive>;

/**
 * Watches a live game for states that have wedged without throwing anything,
 * and reports them as `anomaly` issues.
 *
 * Host-only, matching the engine's own gate (`if (!isHostUser) return` in
 * useYjsGameEngine). Every client sees the same Y.Doc, so letting all of them
 * evaluate would report the same stuck round once per player.
 *
 * It only reports. No toast, no auto-recovery — the thresholds here are
 * untuned guesses, and telling a host their working game is broken is worse
 * than telling nobody. Once the inbox shows which rules never false-positive,
 * nudging the host becomes a defensible next step.
 */
export function useGameWatchdog(reactive: LobbyReactive) {
  // The reporter already dedupes, caps per session, and never throws.
  const { report } = useIssueReporter();

  let state: WatchdogState = {};

  const readSnapshot = (): WatchdogSnapshot | null => {
    const gs = reactive.gameState.value;
    if (!gs) return null;

    // playerList carries spectators too; the engine counts only non-spectators
    // as players, so the rules have to use the same definition or
    // too-few-players and judge-missing both read the wrong roster.
    const activePlayerIds = (reactive.playerList.value ?? [])
      .filter((p) => p.playerType !== "spectator")
      .map((p) => p.$id);

    // Card ids never leave the client — only how many each player holds.
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
  };

  const tick = () => {
    // Losing host (or the doc going away) resets the timers, so a rule that was
    // part-way to firing does not carry a stale clock into a different game.
    if (!reactive.isHost.value) {
      state = {};
      return;
    }

    const snapshot = readSnapshot();
    if (!snapshot) {
      state = {};
      return;
    }

    const result = evaluateRules(WATCHDOG_RULES, snapshot, Date.now(), state);
    state = result.state;

    for (const anomaly of result.fired) {
      // ruleId and phase are what the fingerprint is built from, and both are
      // allowlisted server-side. The rest of the game context arrives on its
      // own via the reporter's context provider.
      report({
        kind: "anomaly",
        message: anomaly.message,
        context: { ruleId: anomaly.ruleId, phase: snapshot.phase },
      });
    }
  };

  // Guarded rather than relying on the timer never firing: this composable's
  // caller renders on the server too, and an interval started there would run
  // detached from any real game.
  if (import.meta.client) {
    useIntervalFn(tick, TICK_MS);
  }
}

export default useGameWatchdog;
