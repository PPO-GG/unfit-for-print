// @vitest-environment node
//
// The end-of-test wedge guard skips the timer-resolved rules under real
// timers. Vitest runs afterEach hooks in reverse, so a suite that registers
// `afterEach(vi.useRealTimers)` after the guard hands it real timers every
// time — and the guard then silently never checks for a stalled round.

import { describe, it, expect, vi, afterEach } from "vitest";
import * as Y from "yjs";
import { shallowRef } from "vue";
import type { LobbyDocResult } from "~/composables/useLobbyDoc";
import { watchDoc, expectTrackedDocsUnwedged } from "./gameInvariants";

/** A round sitting in `submitting` with every eligible play already in. */
function strandedStub(): LobbyDocResult {
  const ydoc = new Y.Doc();
  const stub = {
    doc: shallowRef(ydoc),
    getMeta: () => ydoc.getMap("meta"),
    getSettings: () => ydoc.getMap("settings"),
    getGameState: () => ydoc.getMap("gameState"),
    getSubmissions: () => ydoc.getMap("submissions"),
    getCards: () => ydoc.getMap("cards"),
    getHands: () => ydoc.getMap("hands"),
    getPlayers: () => ydoc.getMap("players"),
  } as unknown as LobbyDocResult;

  for (const id of ["judge", "alice", "bob"]) {
    stub.getPlayers().set(id, JSON.stringify({ userId: id, playerType: "player" }));
  }
  const gs = stub.getGameState();
  gs.set("phase", "submitting");
  gs.set("judgeId", "judge");
  gs.set("skippedPlayers", "[]");
  stub.getSubmissions().set("alice", JSON.stringify(["a1"]));
  stub.getSubmissions().set("bob", JSON.stringify(["b1"]));
  return stub;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("expectTrackedDocsUnwedged", () => {
  it("reports a stalled round in a doc registered under fake timers", () => {
    vi.useFakeTimers();
    watchDoc(strandedStub());

    expect(() => expectTrackedDocsUnwedged()).toThrow(/submitting-settled/);
  });

  it("refuses to pass a fake-timer doc once timers are real again", () => {
    vi.useFakeTimers();
    watchDoc(strandedStub());

    // What a suite's own afterEach(vi.useRealTimers) does when it runs first.
    vi.useRealTimers();

    expect(() => expectTrackedDocsUnwedged()).toThrow(/fake timers/);
  });

  it("still skips the timer-resolved rules for a real-timer doc", () => {
    watchDoc(strandedStub());

    expect(() => expectTrackedDocsUnwedged()).not.toThrow();
  });
});
