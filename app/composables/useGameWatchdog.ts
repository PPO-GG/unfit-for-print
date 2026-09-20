import { useIntervalFn } from "@vueuse/core";
import type { useLobbyReactive } from "~/composables/useLobbyReactive";
import { useIssueReporter } from "~/composables/useIssueReporter";
import {
  WATCHDOG_RULES,
  evaluateRules,
  type WatchdogSnapshot,
  type WatchdogState,
} from "~/utils/watchdogRules";
import { buildWatchdogSnapshot } from "~/utils/watchdogSnapshot";

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

  // Shared with the issue reporter's context provider, so a report and an
  // anomaly can never disagree about what the game looked like.
  const readSnapshot = (): WatchdogSnapshot | null =>
    buildWatchdogSnapshot(reactive);

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
