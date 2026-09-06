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
