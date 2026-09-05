import { describe, it, expect, vi } from "vitest";
import * as Y from "yjs";
import { shallowRef, ref } from "vue";
import { useLobbyReactive } from "~/composables/useLobbyReactive";
import type { LobbyDocResult } from "~/composables/useLobbyDoc";

// useLobbyReactive calls the auto-imported useUserStore() for `myId`; these
// tests only exercise cardTexts, so a minimal stub is enough.
vi.stubGlobal("useUserStore", () => ({ user: { id: "test-user" } }));

function makeStubDoc(): LobbyDocResult {
  const ydoc = new Y.Doc();
  return {
    doc: shallowRef(ydoc),
    connect: async () => {},
    disconnect: () => {},
    awareness: shallowRef(null),
    synced: ref(false),
    connected: ref(false),
    lobbyCode: ref(null),
    getMeta: () => ydoc.getMap("meta"),
    getSettings: () => ydoc.getMap("settings"),
    getGameState: () => ydoc.getMap("gameState"),
    getCards: () => ydoc.getMap("cards"),
    getHands: () => ydoc.getMap("hands"),
    getPlayers: () => ydoc.getMap("players"),
    getChat: () => ydoc.getArray("chat"),
  } as unknown as LobbyDocResult;
}

/** Mirrors what useLobbyMutations.startGame writes: chunked keys + a count. */
function writeChunkedTexts(
  cards: Y.Map<any>,
  entries: Record<string, { text: string; pack: string }>,
  chunkSize = 100,
) {
  const pairs = Object.entries(entries);
  const numChunks = Math.ceil(pairs.length / chunkSize);
  for (let i = 0; i < numChunks; i++) {
    const chunkObj: Record<string, any> = {};
    for (const [id, data] of pairs.slice(i * chunkSize, (i + 1) * chunkSize)) {
      chunkObj[id] = data;
    }
    cards.set(`cardTexts_${i}`, JSON.stringify(chunkObj));
  }
  cards.set("cardTextsChunks", String(numChunks));
}

describe("useLobbyReactive cardTexts", () => {
  it("exposes chunked texts written at game start", () => {
    const stub = makeStubDoc();
    writeChunkedTexts(stub.getCards(), {
      "white-1": { text: "A cool ranch Dorito", pack: "base" },
    });

    const reactive = useLobbyReactive(stub);

    expect(reactive.cardTexts.value["white-1"]?.text).toBe(
      "A cool ranch Dorito",
    );
  });

  it("falls back to the flat key when the game predates chunking", () => {
    const stub = makeStubDoc();
    stub
      .getCards()
      .set(
        "cardTexts",
        JSON.stringify({ "white-1": { text: "Legacy card", pack: "base" } }),
      );

    const reactive = useLobbyReactive(stub);

    expect(reactive.cardTexts.value["white-1"]?.text).toBe("Legacy card");
  });

  // Regression: replenishWhiteDeck merges fresh texts into the FLAT "cardTexts"
  // key while startGame wrote CHUNKED keys. parseCards treated the two as
  // either/or, so once a game had chunks (every real game) every replenished
  // card rendered with empty text in UserHand, which has no on-demand resolve.
  it("merges replenished flat-key texts on top of the chunked ones", () => {
    const stub = makeStubDoc();
    const cards = stub.getCards();

    writeChunkedTexts(cards, {
      "white-1": { text: "A cool ranch Dorito", pack: "base" },
    });
    // What replenishWhiteDeck does after /api/game/draw-cards returns.
    cards.set(
      "cardTexts",
      JSON.stringify({
        "white-999": { text: "A freshly drawn card", pack: "base" },
      }),
    );

    const reactive = useLobbyReactive(stub);

    expect(reactive.cardTexts.value["white-1"]?.text).toBe(
      "A cool ranch Dorito",
    );
    expect(reactive.cardTexts.value["white-999"]?.text).toBe(
      "A freshly drawn card",
    );
  });

  // Precedence must match mergeCardTexts() in useYjsGameEngine, which applies
  // chunks first and then the flat key — otherwise the engine and the UI can
  // still disagree about the same id. In practice the two key sets never
  // overlap (replenish only ever adds ids that were not dealt at start).
  it("resolves an id present in both keys the same way the engine does", () => {
    const stub = makeStubDoc();
    const cards = stub.getCards();

    writeChunkedTexts(cards, {
      "white-1": { text: "Chunked text", pack: "base" },
    });
    cards.set(
      "cardTexts",
      JSON.stringify({ "white-1": { text: "Flat text", pack: "base" } }),
    );

    const reactive = useLobbyReactive(stub);

    expect(reactive.cardTexts.value["white-1"]?.text).toBe("Flat text");
  });
});
