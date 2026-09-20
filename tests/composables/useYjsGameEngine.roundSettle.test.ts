import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Y from "yjs";
import { shallowRef, ref } from "vue";
import { useYjsGameEngine } from "~/composables/useYjsGameEngine";
import type { LobbyDocResult } from "~/composables/useLobbyDoc";
import {
  watchDoc,
  allowWedged,
  expectTrackedDocsUnwedged,
} from "../helpers/gameInvariants";

function wrapDoc(ydoc: Y.Doc): LobbyDocResult {
  return watchDoc({
    doc: shallowRef(ydoc),
    connect: async () => {},
    disconnect: () => {},
    awareness: shallowRef(null),
    synced: ref(false),
    connected: ref(false),
    lobbyCode: ref("ABCD"),
    getMeta: () => ydoc.getMap("meta"),
    getSettings: () => ydoc.getMap("settings"),
    getGameState: () => ydoc.getMap("gameState"),
    getSubmissions: () => ydoc.getMap("submissions"),
    getCards: () => ydoc.getMap("cards"),
    getHands: () => ydoc.getMap("hands"),
    getPlayers: () => ydoc.getMap("players"),
    getChat: () => ydoc.getArray("chat"),
  } as unknown as LobbyDocResult);
}

/** A round sitting in `submitting`, every hand full, nobody submitted yet. */
function seedSubmitting(stub: LobbyDocResult, playerIds: string[]) {
  const meta = stub.getMeta();
  meta.set("hostUserId", playerIds[0]);

  const settings = stub.getSettings();
  settings.set("cardsPerPlayer", 10);
  settings.set("maxPick", 3);
  settings.set("manualDraw", false);

  const players = stub.getPlayers();
  for (const id of playerIds) {
    players.set(
      id,
      JSON.stringify({ userId: id, name: id, playerType: "player" }),
    );
  }

  const hands = stub.getHands();
  for (const id of playerIds) {
    hands.set(
      id,
      JSON.stringify(Array.from({ length: 10 }, (_, i) => `${id}-c${i}`)),
    );
  }

  const cards = stub.getCards();
  cards.set("whiteDeck", JSON.stringify(["w1", "w2", "w3"]));
  cards.set("discardWhite", "[]");
  cards.set("discardBlack", "[]");
  cards.set("blackDeck", "[]");

  const gs = stub.getGameState();
  gs.set("phase", "submitting");
  gs.set("round", 4);
  gs.set("judgeId", playerIds[0]);
  gs.set("playerOrder", JSON.stringify(playerIds));
  gs.set(
    "scores",
    JSON.stringify(Object.fromEntries(playerIds.map((id) => [id, 0]))),
  );
  gs.set("blackCard", JSON.stringify({ id: "black-1", pick: 1 }));
  gs.set("submissions", "{}");
  gs.set("revealedCards", "{}");
  gs.set("skippedPlayers", "[]");
}

/** One full two-way exchange, the way Teleportal eventually delivers both. */
function sync(a: Y.Doc, b: Y.Doc) {
  const fromA = Y.encodeStateAsUpdate(a, Y.encodeStateVector(b));
  const fromB = Y.encodeStateAsUpdate(b, Y.encodeStateVector(a));
  Y.applyUpdate(b, fromA);
  Y.applyUpdate(a, fromB);
}

function engineFor(stub: LobbyDocResult, userId: string) {
  vi.stubGlobal("useUserStore", () => ({ user: { id: userId } }));
  return useYjsGameEngine(stub);
}

function phase(stub: LobbyDocResult): string {
  return stub.getGameState().get("phase") as string;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.useFakeTimers();
});

// Every test in this suite: whatever it was checking, the doc it leaves
// behind must not be one the watchdog would report as a wedged game.
afterEach(expectTrackedDocsUnwedged);

afterEach(() => {
  vi.useRealTimers();
});

describe("useYjsGameEngine — the round that never leaves `submitting`", () => {
  it("advances once both simultaneous submissions have converged", () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const stubA = wrapDoc(docA);
    const stubB = wrapDoc(docB);

    seedSubmitting(stubA, ["judge-1", "alice", "bob"]);
    sync(docA, docB);

    // The window between a click and the round trip through Teleportal:
    // neither client can see the other's play, so neither counts the round as
    // complete inside its own transact.
    engineFor(stubA, "alice").playCard(["alice-c0"]);
    engineFor(stubB, "bob").playCard(["bob-c0"]);

    expect(phase(stubA)).toBe("submitting");
    expect(phase(stubB)).toBe("submitting");

    // Teleportal delivers both ways.
    sync(docA, docB);

    // Nothing else happens in the game — no further click, no leave.
    vi.advanceTimersByTime(5_000);
    sync(docA, docB);

    expect(phase(stubA)).toBe("judging");
    expect(phase(stubB)).toBe("judging");
  });

  // The hole the one-shot resync left: it re-checked once, and a delivery
  // slower than that window meant every client had already looked by the time
  // the plays arrived.
  it("advances when the plays converge after the first re-check has passed", () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const stubA = wrapDoc(docA);
    const stubB = wrapDoc(docB);

    seedSubmitting(stubA, ["judge-1", "alice", "bob"]);
    sync(docA, docB);

    engineFor(stubA, "alice").playCard(["alice-c0"]);
    engineFor(stubB, "bob").playCard(["bob-c0"]);

    // A slow link: the first re-check runs while each client still sees only
    // its own play, and finds nothing to do.
    vi.advanceTimersByTime(2_000);
    expect(phase(stubA)).toBe("submitting");
    expect(phase(stubB)).toBe("submitting");

    // Teleportal finally delivers, with no further click to trigger anything.
    sync(docA, docB);
    vi.advanceTimersByTime(5_000);
    sync(docA, docB);

    expect(phase(stubA)).toBe("judging");
    expect(phase(stubB)).toBe("judging");
  });

  it("gives up re-checking a round that is genuinely still waiting", () => {
    const doc = new Y.Doc();
    const stub = wrapDoc(doc);
    seedSubmitting(stub, ["judge-1", "alice", "bob"]);

    engineFor(stub, "alice").playCard(["alice-c0"]);

    // Bob never plays. No amount of waiting should move the round.
    vi.advanceTimersByTime(60_000);

    expect(phase(stub)).toBe("submitting");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("recovers when a settle downgrade lands after the round was complete", () => {
    const doc = new Y.Doc();
    const stub = wrapDoc(doc);
    seedSubmitting(stub, ["judge-1", "alice", "bob"]);

    engineFor(stub, "alice").playCard(["alice-c0"]);
    engineFor(stub, "bob").playCard(["bob-c0"]);

    // A downgrade back to `submitting` is what settleSubmittingComplete does
    // when the round changed under it. If nothing re-checks afterwards, a
    // complete round sits here forever.
    stub.getGameState().set("phase", "submitting");

    vi.advanceTimersByTime(5_000);

    expect(phase(stub)).toBe("judging");
  });

  it("still lets the judge out when every eligible player was skipped", () => {
    const doc = new Y.Doc();
    const stub = wrapDoc(doc);
    seedSubmitting(stub, ["judge-1", "alice", "bob"]);

    const engine = engineFor(stub, "judge-1");
    engine.skipPlayer("alice");
    engine.skipPlayer("bob");

    // Nothing to judge, but `skipJudge` only exists in `judging` — leaving the
    // round in `submitting` would have no exit at all. So this lands in the
    // state `judging-empty` exists to report, on purpose: the rule is right
    // that it is a bad place to be, and it is still the least bad one.
    allowWedged("judging-empty");
    expect(phase(stub)).toBe("judging");
  });

  it("starts judging when the last player still out is skipped", () => {
    const doc = new Y.Doc();
    const stub = wrapDoc(doc);
    seedSubmitting(stub, ["judge-1", "alice", "bob", "carol"]);

    engineFor(stub, "alice").playCard(["alice-c0"]);
    engineFor(stub, "bob").playCard(["bob-c0"]);

    // Carol is AFK; the host skips her. Everyone eligible has now either
    // submitted or been skipped.
    engineFor(stub, "judge-1").skipPlayer("carol");

    expect(phase(stub)).toBe("judging");
  });
});
