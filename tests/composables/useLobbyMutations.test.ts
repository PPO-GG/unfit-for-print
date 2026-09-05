import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { shallowRef, ref } from "vue";
import { useLobbyMutations } from "~/composables/useLobbyMutations";
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

  it("writes the black pick map into the cards map", () => {
    const stub = makeStubDoc();
    const mutations = useLobbyMutations(stub);

    mutations.startGame(basePayload as any);

    expect(JSON.parse(stub.getCards().get("blackPicks") as string)).toEqual({
      b1: 2,
      b2: 1,
      b3: 3,
    });
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
});
