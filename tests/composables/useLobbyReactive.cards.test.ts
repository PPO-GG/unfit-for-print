// Round-trip tests: write the `cards` map the way the app writes it, then read
// it back through useLobbyReactive.
//
// Both sides of this contract are already unit-tested on their own — the chunk
// helpers in tests/utils/chunkedDocValue.test.ts, the engine in its own suites
// — and both passed while they disagreed about where the black deck lives.
// Only a test that crosses the boundary catches that.

import { describe, it, expect, vi } from "vitest";
import * as Y from "yjs";
import { shallowRef, ref } from "vue";
import { useLobbyReactive } from "~/composables/useLobbyReactive";
import type { LobbyDocResult } from "~/composables/useLobbyDoc";
import { chunkEntries, splitArrayChunks } from "~/utils/chunkedDocValue";

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
    getSubmissions: () => ydoc.getMap("submissions"),
    getCards: () => ydoc.getMap("cards"),
    getHands: () => ydoc.getMap("hands"),
    getPlayers: () => ydoc.getMap("players"),
    getChat: () => ydoc.getArray("chat"),
  } as unknown as LobbyDocResult;
}

/** Exactly what useLobbyMutations.startGame and the engine's writeBlackDeck
 *  put in the doc, down to the deliberately blanked plain key. */
function writeBlackDeck(cards: Y.Map<any>, deck: string[]) {
  for (const [key, value] of chunkEntries(
    "blackDeck",
    splitArrayChunks(deck),
  )) {
    cards.set(key, value);
  }
  cards.set("blackDeck", "[]");
}

describe("useLobbyReactive cards", () => {
  it("reads the black deck the writers actually wrote", () => {
    const stub = makeStubDoc();
    const deck = Array.from({ length: 250 }, (_, i) => `black-${i}`);
    writeBlackDeck(stub.getCards(), deck);

    const reactive = useLobbyReactive(stub);

    expect(reactive.cards.value?.blackDeck).toEqual(deck);
  });

  it("does not report an empty deck while the doc holds one", () => {
    const stub = makeStubDoc();
    writeBlackDeck(stub.getCards(), ["black-1", "black-2", "black-3"]);

    const reactive = useLobbyReactive(stub);

    // The shape the player report arrived in: `blackDeckCount: 0` on a game
    // still dealing prompts.
    expect(reactive.cards.value?.blackDeck?.length).toBe(3);
  });

  it("falls back to the plain key for a game that predates chunking", () => {
    const stub = makeStubDoc();
    stub.getCards().set("blackDeck", JSON.stringify(["legacy-1", "legacy-2"]));

    const reactive = useLobbyReactive(stub);

    expect(reactive.cards.value?.blackDeck).toEqual(["legacy-1", "legacy-2"]);
  });

  it("still reads the unchunked keys beside it", () => {
    const stub = makeStubDoc();
    const cards = stub.getCards();
    writeBlackDeck(cards, ["black-1"]);
    cards.set("whiteDeck", JSON.stringify(["white-1", "white-2"]));
    cards.set("discardWhite", JSON.stringify(["white-3"]));
    cards.set("discardBlack", JSON.stringify(["black-9"]));

    const reactive = useLobbyReactive(stub);

    expect(reactive.cards.value?.whiteDeck).toEqual(["white-1", "white-2"]);
    expect(reactive.cards.value?.discardWhite).toEqual(["white-3"]);
    expect(reactive.cards.value?.discardBlack).toEqual(["black-9"]);
  });
});
