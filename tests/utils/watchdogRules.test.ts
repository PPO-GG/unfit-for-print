// @vitest-environment node
//
// The watchdog's whole value is catching states that throw nothing, and its
// whole risk is crying wolf at a game that is working fine. So every rule is
// tested in both directions: the wedged state it must catch, and the ordinary
// state it must stay quiet about.

import { describe, expect, it } from "vitest";
import {
  WATCHDOG_RULES,
  evaluateRules,
  type WatchdogSnapshot,
  type WatchdogState,
} from "~/utils/watchdogRules";

function snapshot(over: Partial<WatchdogSnapshot> = {}): WatchdogSnapshot {
  return {
    phase: "submitting",
    judgeId: "judge",
    activePlayerIds: ["judge", "alice", "bob"],
    submittedPlayerIds: [],
    skippedPlayerIds: [],
    handSizes: { judge: 10, alice: 10, bob: 10 },
    cardsPerPlayer: 10,
    ...over,
  };
}

function rule(id: string) {
  const found = WATCHDOG_RULES.find((r) => r.id === id);
  if (!found) throw new Error(`no rule ${id}`);
  return found;
}

describe("judging-empty", () => {
  const r = rule("judging-empty");

  it("fires when judging has nothing to judge", () => {
    expect(r.detect(snapshot({ phase: "judging", submittedPlayerIds: [] }))).toBe(true);
  });

  it("stays quiet when judging has submissions", () => {
    expect(
      r.detect(snapshot({ phase: "judging", submittedPlayerIds: ["alice"] })),
    ).toBe(false);
  });

  it("stays quiet during submitting with nothing submitted yet", () => {
    expect(r.detect(snapshot({ phase: "submitting", submittedPlayerIds: [] }))).toBe(
      false,
    );
  });
});

describe("settle-stalled", () => {
  const r = rule("settle-stalled");

  it("fires while the phase is still submitting-complete", () => {
    expect(r.detect(snapshot({ phase: "submitting-complete" }))).toBe(true);
  });

  it("stays quiet in every other phase", () => {
    for (const phase of ["waiting", "submitting", "judging", "roundEnd", "complete"]) {
      expect(r.detect(snapshot({ phase }))).toBe(false);
    }
  });
});

describe("judge-missing", () => {
  const r = rule("judge-missing");

  it("fires when the judge is not among the active players", () => {
    expect(
      r.detect(snapshot({ phase: "judging", judgeId: "ghost" })),
    ).toBe(true);
  });

  it("stays quiet when the judge is present", () => {
    expect(r.detect(snapshot({ phase: "judging", judgeId: "judge" }))).toBe(false);
  });

  // Between games there is legitimately no judge.
  it("stays quiet in waiting even with no judge", () => {
    expect(r.detect(snapshot({ phase: "waiting", judgeId: null }))).toBe(false);
  });

  it("stays quiet when the game is complete", () => {
    expect(r.detect(snapshot({ phase: "complete", judgeId: "ghost" }))).toBe(false);
  });
});

describe("too-few-players", () => {
  const r = rule("too-few-players");

  it("fires when an active round has dropped below three players", () => {
    expect(
      r.detect(snapshot({ phase: "judging", activePlayerIds: ["judge", "alice"] })),
    ).toBe(true);
  });

  it("stays quiet at three players", () => {
    expect(r.detect(snapshot({ phase: "judging" }))).toBe(false);
  });

  // A half-empty lobby waiting for people is the normal case, not a fault.
  it("stays quiet while waiting", () => {
    expect(
      r.detect(snapshot({ phase: "waiting", activePlayerIds: ["alice"] })),
    ).toBe(false);
  });
});

describe("hand-underfilled", () => {
  const r = rule("hand-underfilled");

  it("fires when a player who has not submitted is short of cards", () => {
    expect(
      r.detect(snapshot({ handSizes: { judge: 10, alice: 7, bob: 10 } })),
    ).toBe(true);
  });

  // The rule that makes this usable at all: hands shrink as people play, and
  // nextRound only tops them up at the start of the next round. Flagging every
  // short hand would fire on every normal round.
  it("stays quiet for a player who is short because they already submitted", () => {
    expect(
      r.detect(
        snapshot({
          submittedPlayerIds: ["alice"],
          handSizes: { judge: 10, alice: 8, bob: 10 },
        }),
      ),
    ).toBe(false);
  });

  it("ignores the judge, who plays no cards", () => {
    expect(
      r.detect(snapshot({ handSizes: { judge: 3, alice: 10, bob: 10 } })),
    ).toBe(false);
  });

  it("ignores a skipped player", () => {
    expect(
      r.detect(
        snapshot({
          skippedPlayerIds: ["bob"],
          handSizes: { judge: 10, alice: 10, bob: 2 },
        }),
      ),
    ).toBe(false);
  });

  it("only applies during submitting", () => {
    expect(
      r.detect(
        snapshot({ phase: "judging", handSizes: { judge: 10, alice: 7, bob: 10 } }),
      ),
    ).toBe(false);
  });

  it("stays quiet when a player has no hand entry at all", () => {
    expect(r.detect(snapshot({ handSizes: { judge: 10, alice: 10 } }))).toBe(false);
  });
});

describe("evaluateRules", () => {
  const stalled = snapshot({ phase: "submitting-complete" });
  const healthy = snapshot({ phase: "submitting" });
  const empty: WatchdogState = {};

  it("does not fire before the rule's threshold has elapsed", () => {
    const first = evaluateRules(WATCHDOG_RULES, stalled, 1_000, empty);
    expect(first.fired).toHaveLength(0);

    const soon = evaluateRules(WATCHDOG_RULES, stalled, 5_000, first.state);
    expect(soon.fired).toHaveLength(0);
  });

  it("fires once the condition has held for the threshold", () => {
    const first = evaluateRules(WATCHDOG_RULES, stalled, 1_000, empty);
    const later = evaluateRules(WATCHDOG_RULES, stalled, 20_000, first.state);

    expect(later.fired.map((a) => a.ruleId)).toEqual(["settle-stalled"]);
    expect(later.fired[0]!.message).toContain("submitting-complete");
  });

  it("does not fire the same rule twice while the condition persists", () => {
    let s = evaluateRules(WATCHDOG_RULES, stalled, 1_000, empty).state;
    s = evaluateRules(WATCHDOG_RULES, stalled, 20_000, s).state;

    const again = evaluateRules(WATCHDOG_RULES, stalled, 40_000, s);
    expect(again.fired).toHaveLength(0);
  });

  it("re-arms after the condition clears, so a recurrence is reported", () => {
    let s = evaluateRules(WATCHDOG_RULES, stalled, 1_000, empty).state;
    s = evaluateRules(WATCHDOG_RULES, stalled, 20_000, s).state;
    s = evaluateRules(WATCHDOG_RULES, healthy, 25_000, s).state;

    const back = evaluateRules(WATCHDOG_RULES, stalled, 30_000, s);
    expect(back.fired).toHaveLength(0); // timer restarts, not an instant re-fire

    const held = evaluateRules(WATCHDOG_RULES, stalled, 50_000, back.state);
    expect(held.fired.map((a) => a.ruleId)).toEqual(["settle-stalled"]);
  });

  it("reports nothing at all for a healthy game", () => {
    let s = empty;
    for (const now of [0, 30_000, 60_000, 120_000]) {
      const out = evaluateRules(WATCHDOG_RULES, healthy, now, s);
      expect(out.fired).toHaveLength(0);
      s = out.state;
    }
  });

  it("can fire two different rules independently", () => {
    const broken = snapshot({
      phase: "judging",
      judgeId: "ghost",
      activePlayerIds: ["alice", "bob"],
      submittedPlayerIds: [],
    });
    const first = evaluateRules(WATCHDOG_RULES, broken, 0, empty);
    const later = evaluateRules(WATCHDOG_RULES, broken, 60_000, first.state);

    expect(later.fired.map((a) => a.ruleId).sort()).toEqual([
      "judge-missing",
      "judging-empty",
      "too-few-players",
    ]);
  });

  it("never mutates the state it was handed", () => {
    const before = evaluateRules(WATCHDOG_RULES, stalled, 1_000, empty).state;
    const copy = JSON.parse(JSON.stringify(before));
    evaluateRules(WATCHDOG_RULES, stalled, 20_000, before);
    expect(before).toEqual(copy);
  });
});
