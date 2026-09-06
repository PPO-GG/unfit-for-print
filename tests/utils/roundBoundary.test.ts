import { describe, it, expect } from "vitest";
import {
  isNewPrompt,
  isLegacyRoundStart,
  isSkipAnnouncement,
} from "~/utils/roundBoundary";

describe("isNewPrompt", () => {
  it("is true when the serial advances", () => {
    // A judge skipping the prompt: no phase change at all.
    expect(isNewPrompt(4, 3)).toBe(true);
  });

  it("is false when a doc gains a serial for the first time", () => {
    // First sync after deploy — not a new prompt.
    expect(isNewPrompt(1, undefined)).toBe(false);
  });

  it("is false when the serial is absent entirely", () => {
    expect(isNewPrompt(undefined, undefined)).toBe(false);
  });

  it("is false when the serial has not moved", () => {
    expect(isNewPrompt(3, 3)).toBe(false);
  });
});

describe("isLegacyRoundStart", () => {
  it("is true on the judging to submitting edge with no serial", () => {
    expect(isLegacyRoundStart(undefined, "submitting", "judging")).toBe(true);
  });

  it("is false once the doc carries a serial", () => {
    // The serial watcher owns the reset; this must not double-fire.
    expect(isLegacyRoundStart(0, "submitting", "judging")).toBe(false);
  });

  it("is false on any other phase transition", () => {
    expect(isLegacyRoundStart(undefined, "judging", "submitting")).toBe(false);
  });
});

describe("isSkipAnnouncement", () => {
  it("announces when the trigger appears from undefined (a real skip)", () => {
    // This is the transition every legitimate skip produces — without the
    // fix, requiring a defined `prev` blocked it entirely.
    expect(isSkipAnnouncement(4, undefined)).toBe(true);
  });

  it("stays silent when the trigger falls back to undefined", () => {
    // nextRound clears blackSkipUsed every round.
    expect(isSkipAnnouncement(undefined, 4)).toBe(false);
  });

  it("stays silent when the value has not changed", () => {
    expect(isSkipAnnouncement(4, 4)).toBe(false);
  });

  it("announces a later skip in a subsequent round", () => {
    expect(isSkipAnnouncement(9, 4)).toBe(true);
  });
});

/**
 * The two predicates are read by two separate GameTable watchers that share
 * one `resetPile()`. Each has always been correct alone — the bug that
 * survived nine reviews lived in their COMPOSITION over a real game's
 * transition sequence, where an unseeded `promptSerial` made both decline the
 * first prompt change of every game. Assert the pair, not the parts: exactly
 * one reset per prompt change, and none otherwise.
 */
describe("round-boundary watchers, composed", () => {
  /** What GameTable does: the serial watcher, then the phase watcher. */
  const resetCount = (
    serial: { prev: number | undefined; next: number | undefined },
    phase: { prev: string | undefined; next: string },
  ): number => {
    let resets = 0;
    // Watcher 1 — fires on a promptSerial change.
    if (isNewPrompt(serial.next, serial.prev)) resets++;
    // Watcher 2 — fires on a phase edge, reading the CURRENT serial (i.e.
    // `serial.next`, the value the doc carries once the phase has moved).
    if (isLegacyRoundStart(serial.next, phase.next, phase.prev)) resets++;
    return resets;
  };

  const cases: [
    label: string,
    serial: { prev: number | undefined; next: number | undefined },
    phase: { prev: string | undefined; next: string },
    expected: number,
  ][] = [
    // ── A seeded doc: startGame writes promptSerial 0 up front. ──────────
    [
      "game start on a seeded doc",
      { prev: undefined, next: 0 },
      { prev: "judging", next: "submitting" },
      // The serial appearing is not a prompt change, and the phase watcher
      // stands down because the doc now has a serial. Nothing to reset: the
      // pile is already empty at game start.
      0,
    ],
    [
      "judge skips the prompt (no phase change)",
      { prev: 0, next: 1 },
      { prev: "submitting", next: "submitting" },
      1,
    ],
    [
      "normal round advance",
      { prev: 1, next: 2 },
      { prev: "judging", next: "submitting" },
      1,
    ],
    [
      "departing judge swaps the prompt mid-round",
      { prev: 2, next: 3 },
      { prev: "submitting", next: "submitting" },
      1,
    ],
    // ── Non-boundaries: neither watcher may fire. ────────────────────────
    [
      "submissions close, same prompt",
      { prev: 2, next: 2 },
      { prev: "submitting", next: "judging" },
      0,
    ],
    [
      "the display phase's submitting-complete window",
      { prev: 2, next: 2 },
      { prev: "submitting", next: "submitting" },
      0,
    ],
    [
      "a transient re-parse drops the serial and restores it",
      { prev: 2, next: undefined },
      { prev: "submitting", next: "submitting" },
      0,
    ],
    [
      "...and back again — must not reset mid-round",
      { prev: undefined, next: 2 },
      { prev: "submitting", next: "submitting" },
      0,
    ],
    // ── A legacy doc, created before the serial shipped. ─────────────────
    [
      "legacy doc round advance uses the phase-edge fallback",
      { prev: undefined, next: undefined },
      { prev: "judging", next: "submitting" },
      1,
    ],
    [
      "legacy doc, any other phase edge",
      { prev: undefined, next: undefined },
      { prev: "submitting", next: "judging" },
      0,
    ],
  ];

  it.each(cases)("%s", (_label, serial, phase, expected) => {
    expect(resetCount(serial, phase)).toBe(expected);
  });

  it("loses the reset entirely when the doc is not seeded", () => {
    // This is the hole the seeding in startGame closes, pinned so nobody
    // "simplifies" that seed away. On an UNSEEDED doc the first skip writes
    // promptSerial = 1 (readGameState defaults the missing key to 0), so the
    // serial goes undefined -> 1 with no phase change: the serial watcher
    // needs a defined `prev`, and the phase fallback has just switched itself
    // off because the doc now has a serial. Neither fires.
    expect(
      resetCount(
        { prev: undefined, next: 1 },
        { prev: "submitting", next: "submitting" },
      ),
    ).toBe(0);

    // Seeded, the very same skip is a plain 0 -> 1 and resets exactly once.
    expect(
      resetCount(
        { prev: 0, next: 1 },
        { prev: "submitting", next: "submitting" },
      ),
    ).toBe(1);
  });

  it("fires exactly one reset per prompt change across a whole game", () => {
    // A seeded game: start, a skip, a round advance, another round advance.
    const serials: (number | undefined)[] = [undefined, 0, 1, 2, 3];
    const phases = [
      undefined,
      "submitting",
      "submitting",
      "judging",
      "submitting",
    ] as const;

    let resets = 0;
    for (let i = 1; i < serials.length; i++) {
      resets += resetCount(
        { prev: serials[i - 1], next: serials[i] },
        { prev: phases[i - 1], next: phases[i]! },
      );
    }
    // Three prompt changes after the start (skip, advance, advance); the
    // start itself has no pile to clear. Never zero, never double.
    expect(resets).toBe(3);
  });
});
