// Game-state anomaly rules for the host-side watchdog.
//
// These catch the failure class the rest of issue tracking cannot see: a game
// that has wedged without throwing anything. No exception, no failed request,
// no 500 — just a table that stops advancing. Players describe it as "the game
// froze", and until now it reached nobody.
//
// Every rule is a pure predicate over a snapshot: "is this state wrong right
// now?" The duration logic — how long it has been wrong, and whether we have
// already said so — lives in evaluateRules below. Keeping them apart is what
// lets each rule be tested without a clock, a Y.Doc, or a browser.

/** Phases in which a round is actually meant to be progressing. `waiting` and
 *  `complete` are resting states where most "wrong" shapes are normal. */
const ACTIVE_PHASES = ["submitting", "submitting-complete", "judging", "roundEnd"];

const isActive = (phase: string) => ACTIVE_PHASES.includes(phase);

export interface WatchdogSnapshot {
  phase: string;
  judgeId: string | null;
  /** Non-spectator players currently in the lobby. */
  activePlayerIds: string[];
  submittedPlayerIds: string[];
  skippedPlayerIds: string[];
  /** Player id → number of cards currently held. */
  handSizes: Record<string, number>;
  cardsPerPlayer: number;
}

export interface Anomaly {
  ruleId: string;
  message: string;
}

export interface WatchdogRule {
  id: string;
  /** How long the condition must hold before it counts. Every rule needs one:
   *  most of these states are legal for a moment and only wrong if they last. */
  thresholdMs: number;
  detect: (s: WatchdogSnapshot) => boolean;
  describe: (s: WatchdogSnapshot) => string;
}

export const WATCHDOG_RULES: WatchdogRule[] = [
  {
    // The documented bug at useYjsGameEngine.ts:440 — the table drops into
    // judging with nothing on it, and skipJudge is the only way out.
    id: "judging-empty",
    thresholdMs: 30_000,
    detect: (s) => s.phase === "judging" && s.submittedPlayerIds.length === 0,
    describe: () => "Phase is judging with no submissions to judge",
  },
  {
    // settleSubmittingComplete runs on a ~0.5s timer. If this phase is still
    // here seconds later, that timer never fired.
    id: "settle-stalled",
    thresholdMs: 10_000,
    detect: (s) => s.phase === "submitting-complete",
    describe: () => "Phase stuck at submitting-complete; the settle timer never fired",
  },
  {
    id: "judge-missing",
    thresholdMs: 15_000,
    detect: (s) =>
      isActive(s.phase) && !!s.judgeId && !s.activePlayerIds.includes(s.judgeId),
    describe: (s) => `Judge ${s.judgeId} is not among the active players`,
  },
  {
    // handlePlayerLeave reverts to waiting below three players. Still being in
    // an active phase means that revert did not land.
    id: "too-few-players",
    thresholdMs: 30_000,
    detect: (s) => isActive(s.phase) && s.activePlayerIds.length < 3,
    describe: (s) =>
      `Round still active with only ${s.activePlayerIds.length} player(s)`,
  },
  {
    // Deliberately narrow. Hands shrink as people play and nextRound only tops
    // them up at the start of the next round, so "hand below cardsPerPlayer" is
    // the normal mid-round state and flagging it would fire every round. A
    // player who has NOT submitted, however, should still be holding a full
    // hand — if they are short, replenishment failed (which today only warns).
    id: "hand-underfilled",
    thresholdMs: 30_000,
    detect: (s) =>
      s.phase === "submitting" &&
      s.activePlayerIds.some((id) => {
        if (id === s.judgeId) return false;
        if (s.skippedPlayerIds.includes(id)) return false;
        if (s.submittedPlayerIds.includes(id)) return false;
        const size = s.handSizes[id];
        return typeof size === "number" && size < s.cardsPerPlayer;
      }),
    describe: (s) => `A player who has not submitted holds fewer than ${s.cardsPerPlayer} cards`,
  },
];

/** Every rule id, for the server-side allowlist to be checked against. */
export const WATCHDOG_RULE_IDS = WATCHDOG_RULES.map((r) => r.id);

interface RuleState {
  /** When the condition was first seen continuously true, or null. */
  since: number | null;
  /** Whether this stretch of the condition has already been reported. */
  reported: boolean;
}

export type WatchdogState = Record<string, RuleState>;

/**
 * Advances the watchdog by one tick.
 *
 * Pure: takes the previous state and returns a new one alongside whatever
 * fired, so the composable holds nothing but a timer and a variable. A rule
 * fires once per continuous stretch of its condition — it re-arms only after
 * the condition goes false, so an AFK player cannot produce a stream of
 * identical reports.
 */
export function evaluateRules(
  rules: WatchdogRule[],
  snapshot: WatchdogSnapshot,
  now: number,
  state: WatchdogState,
): { state: WatchdogState; fired: Anomaly[] } {
  const next: WatchdogState = {};
  const fired: Anomaly[] = [];

  for (const rule of rules) {
    const prev = state[rule.id] ?? { since: null, reported: false };

    if (!rule.detect(snapshot)) {
      next[rule.id] = { since: null, reported: false };
      continue;
    }

    const since = prev.since ?? now;
    const held = now - since;
    const shouldFire = !prev.reported && held >= rule.thresholdMs;

    if (shouldFire) {
      fired.push({ ruleId: rule.id, message: rule.describe(snapshot) });
    }

    next[rule.id] = { since, reported: prev.reported || shouldFire };
  }

  return { state: next, fired };
}
