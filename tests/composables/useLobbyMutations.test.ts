import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { shallowRef, ref } from "vue";
import { useLobbyMutations } from "~/composables/useLobbyMutations";
import {
  CHUNK_MAX_BYTES,
  readChunkedArray,
  readChunkedRecord,
} from "~/utils/chunkedDocValue";
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
    lobbyCode: ref(null),
    getMeta: () => ydoc.getMap("meta"),
    getSettings: () => ydoc.getMap("settings"),
    getGameState: () => ydoc.getMap("gameState"),
    getCards: () => ydoc.getMap("cards"),
    getHands: () => ydoc.getMap("hands"),
    getPlayers: () => ydoc.getMap("players"),
    getChat: () => ydoc.getArray("chat"),
  };
}

describe("useLobbyMutations.setPlayerReady", () => {
  it("sets ready=true on an existing player entry", () => {
    const stub = makeStubDoc();
    const mutations = useLobbyMutations(stub);
    const playerId = "user123";

    stub.getPlayers().set(
      playerId,
      JSON.stringify({ userId: playerId, name: "Alice", ready: false }),
    );

    mutations.setPlayerReady(playerId, true);

    const raw = stub.getPlayers().get(playerId);
    expect(JSON.parse(raw!).ready).toBe(true);
  });

  it("sets ready=false after toggling back", () => {
    const stub = makeStubDoc();
    const mutations = useLobbyMutations(stub);
    const playerId = "user456";

    stub.getPlayers().set(
      playerId,
      JSON.stringify({ userId: playerId, name: "Bob", ready: true }),
    );

    mutations.setPlayerReady(playerId, false);

    const raw = stub.getPlayers().get(playerId);
    expect(JSON.parse(raw!).ready).toBe(false);
  });

  it("does nothing if player does not exist", () => {
    const stub = makeStubDoc();
    const mutations = useLobbyMutations(stub);
    expect(() => mutations.setPlayerReady("ghost", true)).not.toThrow();
    expect(stub.getPlayers().get("ghost")).toBeUndefined();
  });

  it("does nothing for a malformed player entry", () => {
    const stub = makeStubDoc();
    const mutations = useLobbyMutations(stub);
    stub.getPlayers().set("corrupt", "not-valid-json{{{{");
    expect(() => mutations.setPlayerReady("corrupt", true)).not.toThrow();
    // Entry should remain unchanged (not overwritten)
    expect(stub.getPlayers().get("corrupt")).toBe("not-valid-json{{{{");
  });
});

describe("useLobbyMutations.startGame card payload", () => {
  const basePayload = {
    whiteDeck: ["w1", "w2"],
    blackDeck: ["b2", "b3"],
    blackCard: { id: "b1", pick: 2 },
    hands: { "p1": ["w3"] },
    cardTexts: {},
    blackPicks: { b1: 2, b2: 1, b3: 3 },
    playerOrder: ["p1"],
    judgeId: "p1",
  };

  // Written across chunk keys, not one: with every pack enabled the pick map is
  // ~58KB and the deck ~55KB, and a single Y.Doc update that large is silently
  // dropped on its way to the server. Asserted through the reader, since the
  // contract is that the value round-trips — not which keys hold it.
  it("writes the black pick map into the cards map", () => {
    const stub = makeStubDoc();
    const mutations = useLobbyMutations(stub);

    mutations.startGame(basePayload as any);

    const raw = Object.fromEntries(stub.getCards().entries());
    expect(readChunkedRecord<number>(raw, "blackPicks")).toEqual({
      b1: 2,
      b2: 1,
      b3: 3,
    });
  });

  it("writes the black deck so it reads back intact", () => {
    const stub = makeStubDoc();
    const mutations = useLobbyMutations(stub);

    mutations.startGame(basePayload as any);

    const raw = Object.fromEntries(stub.getCards().entries());
    expect(readChunkedArray<string>(raw, "blackDeck")).toEqual(["b2", "b3"]);
  });

  // The reason chunking exists: no single update may approach the ~58KB
  // ceiling, however many packs the host enabled.
  it("keeps every card key under the chunk budget for an all-packs deck", () => {
    const bigDeck = Array.from(
      { length: 1500 },
      (_, i) => `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`,
    );
    const bigPicks = Object.fromEntries(bigDeck.map((id) => [id, 1]));

    const stub = makeStubDoc();
    useLobbyMutations(stub).startGame({
      ...basePayload,
      blackDeck: bigDeck,
      blackPicks: bigPicks,
    } as any);

    const raw = Object.fromEntries(stub.getCards().entries());
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "string") {
        expect(
          Buffer.byteLength(value),
          `${key} exceeds the chunk budget`,
        ).toBeLessThanOrEqual(CHUNK_MAX_BYTES);
      }
    }
    expect(readChunkedArray<string>(raw, "blackDeck")).toEqual(bigDeck);
    expect(readChunkedRecord<number>(raw, "blackPicks")).toEqual(bigPicks);
  });

  it("writes no card-text keys at all", () => {
    const stub = makeStubDoc();
    const mutations = useLobbyMutations(stub);

    mutations.startGame(basePayload as any);

    // No text in the doc means no ~64KB ceiling and no chunking to get wrong.
    const keys = [...stub.getCards().keys()];
    expect(keys.filter((k) => k.startsWith("cardTexts"))).toEqual([]);
  });

  it("stores the opening black card without its text", () => {
    const stub = makeStubDoc();
    const mutations = useLobbyMutations(stub);

    mutations.startGame(basePayload as any);

    const blackCard = JSON.parse(
      stub.getGameState().get("blackCard") as string,
    );
    expect(blackCard).toEqual({ id: "b1", pick: 2 });
  });

  it("seeds promptSerial and blackSkipUsed to enable first prompt reset", () => {
    // These seeds are critical: without them the card-table animation reset
    // guards both decline on the first prompt change of a game, since the
    // GameTable watchers require a defined prior state and the legacy-round-start
    // logic only fires while the serial is absent.
    const stub = makeStubDoc();
    const mutations = useLobbyMutations(stub);

    mutations.startGame(basePayload as any);

    const gs = stub.getGameState();
    // promptSerial must be a raw number (like round), not a string
    expect(gs.get("promptSerial")).toBe(0);
    // blackSkipUsed must be JSON-stringified (unlike promptSerial);
    // stored and retrieved as the string "false", not the boolean false
    expect(gs.get("blackSkipUsed")).toBe("false");
  });

  const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // Keys the stat_rounds ledger server-side: `round` restarts at 1 every
  // game, so without a per-game id two games' round 1 would collide.
  it("stamps the game with a uuid gameId", () => {
    const stub = makeStubDoc();
    useLobbyMutations(stub).startGame(basePayload as any);

    expect(stub.getGameState().get("gameId")).toMatch(UUID_V4);
  });

  it("gives a rematch a fresh gameId", () => {
    const stub = makeStubDoc();
    const mutations = useLobbyMutations(stub);

    mutations.startGame(basePayload as any);
    const first = stub.getGameState().get("gameId");
    mutations.startGame(basePayload as any);

    expect(stub.getGameState().get("gameId")).not.toBe(first);
  });
});
