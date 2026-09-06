import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Y from "yjs";
import { shallowRef, ref } from "vue";
import { useYjsGameEngine } from "~/composables/useYjsGameEngine";
import type { LobbyDocResult } from "~/composables/useLobbyDoc";

// The submitting -> judging transition is deferred by 500ms so the "all cards
// in" animation has room to play. These tests cover what happens when the round
// changes *inside* that window — the judge skipping the prompt, the judge
// leaving, the player who armed the timer navigating away.

function makeStubDoc(): { stub: LobbyDocResult; ydoc: Y.Doc } {
  const ydoc = new Y.Doc();
  const doc = shallowRef<Y.Doc | null>(ydoc);
  // useLobbyDoc's accessors all go through requireDoc(), so they THROW once
  // disconnect() has nulled the ref. The stub has to do the same, otherwise a
  // timer firing after the player left looks harmless here and explodes in
  // production.
  const map = (name: string) => () => {
    if (!doc.value) throw new Error("[LobbyDoc] No active Y.Doc");
    return ydoc.getMap(name);
  };
  return {
    ydoc,
    stub: {
      doc,
      connect: async () => {},
      disconnect: () => {},
      awareness: shallowRef(null),
      synced: ref(false),
      connected: ref(false),
      lobbyCode: ref("ABCD"),
      getMeta: map("meta"),
      getSettings: map("settings"),
      getGameState: map("gameState"),
      getCards: map("cards"),
      getHands: map("hands"),
      getPlayers: map("players"),
      getChat: () => ydoc.getArray("chat"),
    } as unknown as LobbyDocResult,
  };
}

/**
 * A game one submission short of complete: judge-1 judging, p-2 already in,
 * p-3 still holding the card that closes the round.
 */
function seedOneShortOfComplete(stub: LobbyDocResult) {
  stub.getMeta().set("hostUserId", "judge-1");

  const settings = stub.getSettings();
  settings.set("maxPick", 3);
  settings.set("cardsPerPlayer", 10);

  const players = stub.getPlayers();
  for (const id of ["judge-1", "p-2", "p-3"]) {
    players.set(
      id,
      JSON.stringify({ userId: id, name: id, playerType: "player" }),
    );
  }

  const hands = stub.getHands();
  hands.set("judge-1", "[]");
  hands.set("p-2", JSON.stringify(["keep-2"]));
  hands.set("p-3", JSON.stringify(["w3", "keep-3"]));

  const cards = stub.getCards();
  cards.set("whiteDeck", JSON.stringify(["w-spare"]));
  cards.set("discardWhite", "[]");
  cards.set("discardBlack", "[]");
  cards.set("blackDeck", JSON.stringify(["b-next"]));
  cards.set("blackPicks", JSON.stringify({ "b-next": 1 }));

  const gs = stub.getGameState();
  gs.set("phase", "submitting");
  gs.set("round", 4);
  gs.set("promptSerial", 4);
  gs.set("judgeId", "judge-1");
  gs.set("playerOrder", JSON.stringify(["judge-1", "p-2", "p-3"]));
  gs.set("scores", JSON.stringify({}));
  gs.set("submissions", JSON.stringify({ "p-2": ["w2"] }));
  gs.set("revealedCards", "{}");
  gs.set("skippedPlayers", "[]");
  gs.set("blackCard", JSON.stringify({ id: "b-old", pick: 1 }));
}

const phaseOf = (stub: LobbyDocResult) =>
  stub.getGameState().get("phase") as string;

beforeEach(() => {
  vi.useFakeTimers();
  vi.unstubAllGlobals();
  vi.stubGlobal("useUserStore", () => ({ user: { id: "p-3" } }));
  vi.stubGlobal("$fetch", async () => null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useYjsGameEngine — deferred submitting -> judging transition", () => {
  it("advances to judging once the animation delay elapses", () => {
    const { stub } = makeStubDoc();
    seedOneShortOfComplete(stub);

    const result = useYjsGameEngine(stub).playCard(["w3"], "p-3");

    expect(result.success).toBe(true);
    expect(phaseOf(stub)).toBe("submitting-complete");

    vi.advanceTimersByTime(500);
    expect(phaseOf(stub)).toBe("judging");
  });

  it("returns the round to submitting when the prompt was skipped inside the delay", () => {
    const { stub } = makeStubDoc();
    seedOneShortOfComplete(stub);

    useYjsGameEngine(stub).playCard(["w3"], "p-3");
    expect(phaseOf(stub)).toBe("submitting-complete");

    // What the doc looks like after the judge's skip merges in: the judge
    // never saw "submitting-complete", so their transaction cleared the board
    // and swapped the prompt without touching `phase`.
    const gs = stub.getGameState();
    gs.set("submissions", "{}");
    gs.set("blackCard", JSON.stringify({ id: "b-next", pick: 1 }));
    gs.set("promptSerial", 5);
    gs.set("blackSkipUsed", JSON.stringify(true));

    vi.advanceTimersByTime(500);

    // Judging an empty board is unwinnable and unskippable — the round has to
    // go back to taking submissions against the new prompt.
    expect(phaseOf(stub)).toBe("submitting");
  });

  it("leaves the phase alone when the round already moved on inside the delay", () => {
    const { stub } = makeStubDoc();
    seedOneShortOfComplete(stub);

    useYjsGameEngine(stub).playCard(["w3"], "p-3");

    // e.g. the judge left and handlePlayerLeave restarted the round.
    stub.getGameState().set("phase", "roundEnd");

    vi.advanceTimersByTime(500);

    expect(phaseOf(stub)).toBe("roundEnd");
  });

  it("does not throw when the doc is gone by the time the delay elapses", () => {
    const { stub } = makeStubDoc();
    seedOneShortOfComplete(stub);

    useYjsGameEngine(stub).playCard(["w3"], "p-3");
    (stub.doc as { value: Y.Doc | null }).value = null;

    expect(() => vi.advanceTimersByTime(500)).not.toThrow();
  });
});
