import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";
import { shallowRef, ref } from "vue";
import { useYjsGameEngine } from "~/composables/useYjsGameEngine";
import type { LobbyDocResult } from "~/composables/useLobbyDoc";

function makeStubDoc(): LobbyDocResult {
  const ydoc = new Y.Doc();
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
    getCards: () => ydoc.getMap("cards"),
    getHands: () => ydoc.getMap("hands"),
    getPlayers: () => ydoc.getMap("players"),
    getChat: () => ydoc.getArray("chat"),
  } as unknown as LobbyDocResult;
}

/** A game sitting in roundEnd, ready for nextRound() to advance it. */
function seedRoundEnd(
  stub: LobbyDocResult,
  opts: { blackDeck: string[]; blackPicks: Record<string, number>; maxPick?: number },
) {
  const meta = stub.getMeta();
  meta.set("hostUserId", "host-1");

  const settings = stub.getSettings();
  settings.set("cardPacks", JSON.stringify(["base"]));
  settings.set("cardsPerPlayer", 10);
  settings.set("maxPick", opts.maxPick ?? 3);
  settings.set("manualDraw", false);

  const players = stub.getPlayers();
  for (const id of ["host-1", "player-2"]) {
    players.set(
      id,
      JSON.stringify({ userId: id, name: id, playerType: "player" }),
    );
  }

  const hands = stub.getHands();
  hands.set("host-1", JSON.stringify([]));
  hands.set("player-2", JSON.stringify([]));

  const cards = stub.getCards();
  cards.set("whiteDeck", JSON.stringify(["w1", "w2", "w3"]));
  cards.set("discardWhite", "[]");
  cards.set("discardBlack", "[]");
  cards.set("blackDeck", JSON.stringify(opts.blackDeck));
  cards.set("blackPicks", JSON.stringify(opts.blackPicks));

  const gs = stub.getGameState();
  gs.set("phase", "roundEnd");
  gs.set("round", 1);
  gs.set("judgeId", "host-1");
  gs.set("playerOrder", JSON.stringify(["host-1", "player-2"]));
  gs.set("scores", JSON.stringify({ "host-1": 0, "player-2": 0 }));
  gs.set("submissions", "{}");
  gs.set("revealedCards", "{}");
  gs.set("skippedPlayers", "[]");
}

function readBlackCard(stub: LobbyDocResult) {
  const raw = stub.getGameState().get("blackCard");
  return raw ? JSON.parse(raw as string) : null;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("useUserStore", () => ({ user: { id: "host-1" } }));
});

describe("useYjsGameEngine.nextRound black card selection", () => {
  it("selects the next black card and records its pick count", () => {
    const stub = makeStubDoc();
    seedRoundEnd(stub, {
      blackDeck: ["black-1"],
      blackPicks: { "black-1": 2 },
    });

    const engine = useYjsGameEngine(stub);
    const result = engine.nextRound();

    expect(result.success).toBe(true);
    expect(readBlackCard(stub)).toMatchObject({ id: "black-1", pick: 2 });
  });

  it("does not embed the black card's text in the Y.Doc", () => {
    const stub = makeStubDoc();
    seedRoundEnd(stub, {
      blackDeck: ["black-1"],
      blackPicks: { "black-1": 1 },
    });

    const engine = useYjsGameEngine(stub);
    engine.nextRound();

    // Text is resolved per client through /api/cards/resolve; the reactive
    // layer overlays it onto blackCard so components still read .text.
    expect(readBlackCard(stub)).not.toHaveProperty("text");
  });

  it("skips black cards whose pick exceeds maxPick", () => {
    const stub = makeStubDoc();
    // pop() takes from the end, so "black-hi" is the first candidate.
    seedRoundEnd(stub, {
      blackDeck: ["black-ok", "black-hi"],
      blackPicks: { "black-ok": 1, "black-hi": 3 },
      maxPick: 1,
    });

    const engine = useYjsGameEngine(stub);
    engine.nextRound();

    expect(readBlackCard(stub)?.id).toBe("black-ok");
    const discard = JSON.parse(stub.getCards().get("discardBlack") as string);
    expect(discard).toContain("black-hi");
  });

  it("treats a card with no recorded pick as a single-pick card", () => {
    const stub = makeStubDoc();
    seedRoundEnd(stub, { blackDeck: ["black-unknown"], blackPicks: {} });

    const engine = useYjsGameEngine(stub);
    engine.nextRound();

    expect(readBlackCard(stub)).toMatchObject({ id: "black-unknown", pick: 1 });
  });

  it("still reads pick from a legacy doc that embedded card texts", () => {
    const stub = makeStubDoc();
    seedRoundEnd(stub, { blackDeck: ["black-legacy"], blackPicks: {} });
    // A game already in flight when this shipped: texts chunked, no blackPicks.
    stub.getCards().delete("blackPicks");
    stub
      .getCards()
      .set(
        "cardTexts_0",
        JSON.stringify({ "black-legacy": { text: "Old", pack: "base", pick: 2 } }),
      );
    stub.getCards().set("cardTextsChunks", "1");

    const engine = useYjsGameEngine(stub);
    engine.nextRound();

    expect(readBlackCard(stub)).toMatchObject({ id: "black-legacy", pick: 2 });
  });
});
