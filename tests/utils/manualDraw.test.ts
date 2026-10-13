// @vitest-environment node
//
// How many empty slots a player can fill from the deck. Every manual-draw hint
// — the dashed slots in the hand, the deck's badge, the phone's Draw button —
// reads this one number, so it has to agree with what engine.drawCards will
// actually accept, or the UI invites a tap that does nothing.

import { describe, expect, it } from "vitest";
import { manualDrawSlots } from "~/utils/manualDraw";

const base = {
  manualDraw: true,
  handSize: 7,
  cardsPerPlayer: 10,
  isJudge: false,
  isParticipant: true,
  hasSubmitted: false,
};

describe("manualDrawSlots", () => {
  it("is the hand's shortfall when the player may draw", () => {
    expect(manualDrawSlots(base)).toBe(3);
  });

  it("is zero with manual draw off, where nextRound refills hands itself", () => {
    expect(manualDrawSlots({ ...base, manualDraw: false })).toBe(0);
  });

  it("is zero for a full hand, and never negative for an overfull one", () => {
    expect(manualDrawSlots({ ...base, handSize: 10 })).toBe(0);
    expect(manualDrawSlots({ ...base, handSize: 12 })).toBe(0);
  });

  it("is zero for the judge, whom drawCards refuses", () => {
    expect(manualDrawSlots({ ...base, isJudge: true })).toBe(0);
  });

  it("is zero for a spectator", () => {
    expect(manualDrawSlots({ ...base, isParticipant: false })).toBe(0);
  });

  // drawCards refuses a player who has already played this round, since a
  // skipped prompt hands those cards back. The deck used to keep pulsing at
  // them anyway.
  it("is zero once the player has submitted this round", () => {
    expect(manualDrawSlots({ ...base, hasSubmitted: true })).toBe(0);
  });
});
