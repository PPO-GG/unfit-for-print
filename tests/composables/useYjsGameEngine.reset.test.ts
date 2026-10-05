import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import { shallowRef, ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { useYjsGameEngine } from "~/composables/useYjsGameEngine";
import type { LobbyDocResult } from "~/composables/useLobbyDoc";

function makeStubDoc(): LobbyDocResult {
  const ydoc = new Y.Doc();
  return {
    doc: shallowRef(ydoc),
    connect: async () => {},
    disconnect: () => {},
    awareness: shallowRef(null),
    synced: ref(true),
    connected: ref(true),
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

// Everyone readied up to start the last game. Carried over, those flags made
// the lobby auto-start the next one as soon as it had enough players again,
// before the host could change anything.
describe("useYjsGameEngine.resetGame", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal("useUserStore", () => ({ user: { id: "host-1" } }));
  });

  it("un-readies every player for the next game", () => {
    const stub = makeStubDoc();
    const players = stub.getPlayers();
    players.set("host-1", JSON.stringify({ userId: "host-1", name: "Host", playerType: "player", ready: true }));
    players.set("p2", JSON.stringify({ userId: "p2", name: "Sam", playerType: "player", ready: true }));
    players.set("b1", JSON.stringify({ userId: "b1", name: "Bot", playerType: "bot" }));
    stub.getGameState().set("phase", "complete");

    useYjsGameEngine(stub).resetGame();

    const read = (id: string) => JSON.parse(players.get(id) as string);
    expect(stub.getGameState().get("phase")).toBe("waiting");
    expect(read("host-1").ready).toBe(false);
    expect(read("p2").ready).toBe(false);
    // Everything else about the player is untouched.
    expect(read("p2")).toMatchObject({ userId: "p2", name: "Sam", playerType: "player" });
    expect(read("b1")).toMatchObject({ userId: "b1", name: "Bot", playerType: "bot" });
  });
});
