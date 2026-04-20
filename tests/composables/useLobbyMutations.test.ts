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
  });
});
