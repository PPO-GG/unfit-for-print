import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Y from "yjs";
import { shallowRef, ref } from "vue";
import { useYjsGameEngine } from "~/composables/useYjsGameEngine";
import type { LobbyDocResult } from "~/composables/useLobbyDoc";
import { watchDoc, expectTrackedDocsUnwedged } from "../helpers/gameInvariants";

function wrapDoc(ydoc: Y.Doc, clientID: number, watched = true): LobbyDocResult {
  ydoc.clientID = clientID;
  const stub = {
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
  } as unknown as LobbyDocResult;
  return watched ? watchDoc(stub) : stub;
}

/** Round 1 has just ended: `host` judged, everyone else played one card. */
function seedRoundEnd(stub: LobbyDocResult, playerIds: string[]) {
  stub.getMeta().set("hostUserId", "host");
  stub.getMeta().set("status", "playing");
  const settings = stub.getSettings();
  settings.set("cardsPerPlayer", 10);
  settings.set("maxPick", 3);
  for (const id of playerIds) {
    stub
      .getPlayers()
      .set(id, JSON.stringify({ userId: id, name: id, playerType: "player" }));
    const n = id === "host" ? 10 : 9;
    stub
      .getHands()
      .set(id, JSON.stringify(Array.from({ length: n }, (_, i) => `${id}-c${i}`)));
  }
  const cards = stub.getCards();
  cards.set("whiteDeck", JSON.stringify(Array.from({ length: 50 }, (_, i) => `w${i}`)));
  cards.set("blackDeck", JSON.stringify(["b1", "b2", "b3"]));
  cards.set("discardWhite", "[]");
  cards.set("discardBlack", "[]");
  const gs = stub.getGameState();
  gs.set("phase", "roundEnd");
  gs.set("round", 1);
  gs.set("judgeId", "host");
  gs.set("playerOrder", JSON.stringify(playerIds));
  gs.set("scores", JSON.stringify(Object.fromEntries(playerIds.map((id) => [id, 0]))));
  gs.set("blackCard", JSON.stringify({ id: "b0", pick: 1 }));
  gs.set("submissions", "{}");
  gs.set("revealedCards", "{}");
  gs.set("skippedPlayers", "[]");
  gs.set("promptSerial", 1);
}

function sync(a: Y.Doc, b: Y.Doc) {
  const fromA = Y.encodeStateAsUpdate(a, Y.encodeStateVector(b));
  const fromB = Y.encodeStateAsUpdate(b, Y.encodeStateVector(a));
  Y.applyUpdate(b, fromA);
  Y.applyUpdate(a, fromB);
}

function engineFor(stub: LobbyDocResult, userId: string) {
  vi.stubGlobal("useUserStore", () => ({ user: { id: userId } }));
  vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: async () => ({}) }));
  return useYjsGameEngine(stub);
}

/** What leaveLobby does on the leaver's own client. */
function leave(stub: LobbyDocResult, userId: string) {
  engineFor(stub, userId).handlePlayerLeave(userId);
  stub.doc.value!.transact(() => {
    stub.getPlayers().delete(userId);
    stub.getHands().delete(userId);
  });
}

/**
 * The race behind lobby B36R: `leaver` taps Leave during roundEnd at the same
 * moment the host's nextRound fires, before either client has seen the other.
 * The host's id is the higher one, so its `phase` write wins the tie — the
 * outcome that wedges. (With the tie the other way the leaver's revert to
 * waiting wins and nothing is wrong.)
 */
function raceLeaveAgainstNextRound(playerIds: string[], leaver: string) {
  const hostStub = wrapDoc(new Y.Doc(), 2);
  // Not held to the invariants: the leaver disconnects, and the repair under
  // test happens on the host's doc after this exchange.
  const leaverStub = wrapDoc(new Y.Doc(), 1, false);
  seedRoundEnd(hostStub, playerIds);
  sync(hostStub.doc.value!, leaverStub.doc.value!);

  engineFor(hostStub, "host").nextRound();
  leave(leaverStub, leaver);

  sync(hostStub.doc.value!, leaverStub.doc.value!);
  return hostStub;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.useFakeTimers();
});

afterEach(expectTrackedDocsUnwedged);

afterEach(() => {
  vi.useRealTimers();
});

describe("leaving while the host starts the next round", () => {
  it("merges into a round whose judge has left, holding a hand", () => {
    // Pins the precondition the repair exists for, so a change to Yjs or to
    // nextRound that makes the race benign shows up here rather than silently.
    const stub = raceLeaveAgainstNextRound(["host", "alice", "bob"], "alice");
    const gs = stub.getGameState();

    expect(gs.get("phase")).toBe("submitting");
    expect(gs.get("judgeId")).toBe("alice");
    expect(stub.getPlayers().has("alice")).toBe(false);
    expect(JSON.parse(stub.getHands().get("alice") as string)).toHaveLength(10);

    engineFor(stub, "host").reconcileDepartedPlayers();
  });
});

describe("useYjsGameEngine.reconcileDepartedPlayers", () => {
  it("returns the game to waiting when the race leaves too few players", () => {
    const stub = raceLeaveAgainstNextRound(["host", "alice", "bob"], "alice");

    expect(engineFor(stub, "host").reconcileDepartedPlayers()).toBe(true);

    expect(stub.getGameState().get("phase")).toBe("waiting");
    expect(stub.getMeta().get("status")).toBe("waiting");
    expect(stub.getHands().has("alice")).toBe(false);
  });

  it("hands the round to a seated judge when enough players remain", () => {
    const stub = raceLeaveAgainstNextRound(["host", "alice", "bob", "carol"], "alice");

    expect(engineFor(stub, "host").reconcileDepartedPlayers()).toBe(true);

    const gs = stub.getGameState();
    expect(gs.get("phase")).toBe("submitting");
    expect(["host", "bob", "carol"]).toContain(gs.get("judgeId"));
    expect(stub.getHands().has("alice")).toBe(false);
  });

  it("drops a departed non-judge's submission and hand", () => {
    const stub = wrapDoc(new Y.Doc(), 1);
    seedRoundEnd(stub, ["host", "alice", "bob", "carol"]);
    engineFor(stub, "host").nextRound(); // alice judges
    engineFor(stub, "bob").playCard(["bob-c0"]);

    // A removal that skipped handlePlayerLeave, as the race does.
    stub.getPlayers().delete("bob");

    expect(engineFor(stub, "host").reconcileDepartedPlayers()).toBe(true);

    expect(stub.getHands().has("bob")).toBe(false);
    expect(stub.getSubmissions().has("bob")).toBe(false);
    expect(stub.getGameState().get("judgeId")).toBe("alice");
  });

  it("returns to waiting when a kick leaves two players and no stray hand", () => {
    const stub = wrapDoc(new Y.Doc(), 1);
    seedRoundEnd(stub, ["host", "alice", "bob"]);
    engineFor(stub, "host").nextRound(); // alice judges

    // kickPlayer: skipPlayer, then players + hands deleted together.
    engineFor(stub, "host").skipPlayer("bob");
    stub.doc.value!.transact(() => {
      stub.getPlayers().delete("bob");
      stub.getHands().delete("bob");
    });

    expect(engineFor(stub, "host").reconcileDepartedPlayers()).toBe(true);
    expect(stub.getGameState().get("phase")).toBe("waiting");
  });

  it("changes nothing in a healthy round", () => {
    const stub = wrapDoc(new Y.Doc(), 1);
    seedRoundEnd(stub, ["host", "alice", "bob"]);
    engineFor(stub, "host").nextRound();
    const before = Y.encodeStateVector(stub.doc.value!);

    expect(engineFor(stub, "host").reconcileDepartedPlayers()).toBe(false);
    expect(Y.encodeStateVector(stub.doc.value!)).toEqual(before);
  });

  it("leaves a spectator alone", () => {
    const stub = wrapDoc(new Y.Doc(), 1);
    seedRoundEnd(stub, ["host", "alice", "bob"]);
    stub
      .getPlayers()
      .set("sam", JSON.stringify({ userId: "sam", name: "sam", playerType: "spectator" }));
    engineFor(stub, "host").nextRound();

    expect(engineFor(stub, "host").reconcileDepartedPlayers()).toBe(false);
  });

  it("does nothing on a client that is not the host", () => {
    const stub = raceLeaveAgainstNextRound(["host", "alice", "bob"], "alice");

    expect(engineFor(stub, "bob").reconcileDepartedPlayers()).toBe(false);
    expect(stub.getGameState().get("phase")).toBe("submitting");

    engineFor(stub, "host").reconcileDepartedPlayers();
  });
});
