import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";
import { shallowRef, ref } from "vue";
import { useYjsGameEngine } from "~/composables/useYjsGameEngine";
import type { LobbyDocResult } from "~/composables/useLobbyDoc";
import { readSubmissions } from "~/utils/submissions";

function wrapDoc(ydoc: Y.Doc): LobbyDocResult {
  return {
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
}

const PLAYERS = ["judge-1", "alice", "bob"];

/** A round sitting in `submitting`, every hand full, nobody submitted yet. */
function seedSubmitting(stub: LobbyDocResult) {
  const meta = stub.getMeta();
  meta.set("hostUserId", "judge-1");

  const settings = stub.getSettings();
  settings.set("cardsPerPlayer", 10);
  settings.set("maxPick", 3);
  settings.set("manualDraw", false);

  const players = stub.getPlayers();
  for (const id of PLAYERS) {
    players.set(
      id,
      JSON.stringify({ userId: id, name: id, playerType: "player" }),
    );
  }

  const hands = stub.getHands();
  for (const id of PLAYERS) {
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
  gs.set("round", 5);
  gs.set("judgeId", "judge-1");
  gs.set("playerOrder", JSON.stringify(PLAYERS));
  gs.set("scores", JSON.stringify({ "judge-1": 0, alice: 0, bob: 0 }));
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

/** Read submissions the way the app does — the merged view, not either store
 *  on its own. */
function readSubs(stub: LobbyDocResult): Record<string, string[]> {
  return readSubmissions(stub.getGameState(), stub.getSubmissions());
}

function handSize(stub: LobbyDocResult, id: string): number {
  return (JSON.parse(stub.getHands().get(id) as string) as string[]).length;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("useYjsGameEngine.playCard — two players submitting at once", () => {
  it("keeps both submissions when neither client has seen the other's", () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const stubA = wrapDoc(docA);
    const stubB = wrapDoc(docB);

    seedSubmitting(stubA);
    sync(docA, docB);

    // Neither client has the other's update yet — the window between a click
    // and the round trip through Teleportal.
    engineFor(stubA, "alice").playCard(["alice-c0"]);
    engineFor(stubB, "bob").playCard(["bob-c0"]);

    sync(docA, docB);

    expect(Object.keys(readSubs(stubA)).sort()).toEqual(["alice", "bob"]);
  });

  it("never leaves a player short a card with no submission to show for it", () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const stubA = wrapDoc(docA);
    const stubB = wrapDoc(docB);

    seedSubmitting(stubA);
    sync(docA, docB);

    engineFor(stubA, "alice").playCard(["alice-c0"]);
    engineFor(stubB, "bob").playCard(["bob-c0"]);

    sync(docA, docB);

    const submissions = readSubs(stubA);

    // This is the `hand-underfilled` watchdog rule, in one assertion: a
    // non-judge who has not submitted must still be holding a full hand.
    for (const id of ["alice", "bob"]) {
      if (!submissions[id]) {
        expect(
          handSize(stubA, id),
          `${id} has no submission but holds ${handSize(stubA, id)} cards`,
        ).toBe(10);
      }
    }
  });
});

describe("useYjsGameEngine submissions — docs written by the previous build", () => {
  it("still sees a submission left in the retired gameState blob", () => {
    const doc = new Y.Doc();
    const stub = wrapDoc(doc);
    seedSubmitting(stub);

    // What a client on the previous build wrote: the whole object, under one
    // gameState key, with no per-player map at all.
    stub.getGameState().set("submissions", JSON.stringify({ alice: ["a"] }));

    expect(readSubs(stub)).toEqual({ alice: ["a"] });

    // And a submission on this build lands alongside it rather than over it.
    engineFor(stub, "bob").playCard(["bob-c0"]);
    expect(Object.keys(readSubs(stub)).sort()).toEqual(["alice", "bob"]);
  });

  it("clears the retired blob too, so last round's plays cannot come back", () => {
    const doc = new Y.Doc();
    const stub = wrapDoc(doc);
    seedSubmitting(stub);
    stub.getGameState().set("submissions", JSON.stringify({ alice: ["a"] }));

    engineFor(stub, "bob").playCard(["bob-c0"]);

    // Stand in for the 500ms submitting-complete animation the timer drives.
    stub.getGameState().set("phase", "judging");

    // Judge picks, then the host advances — the round's two clear sites.
    const engine = engineFor(stub, "judge-1");
    engine.selectWinner("bob");
    engine.nextRound();

    expect(readSubs(stub)).toEqual({});
    expect(stub.getGameState().get("submissions")).toBe("{}");
  });

  it("drops only the leaver's submission when a player quits mid-round", () => {
    const doc = new Y.Doc();
    const stub = wrapDoc(doc);
    seedSubmitting(stub);

    engineFor(stub, "alice").playCard(["alice-c0"]);
    engineFor(stub, "bob").playCard(["bob-c0"]);

    engineFor(stub, "judge-1").handlePlayerLeave("alice");

    expect(Object.keys(readSubs(stub))).toEqual(["bob"]);
  });
});
