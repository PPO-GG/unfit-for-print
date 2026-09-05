import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";
import { shallowRef, ref } from "vue";
import { useYjsGameEngine } from "~/composables/useYjsGameEngine";
import type { LobbyDocResult } from "~/composables/useLobbyDoc";

vi.stubGlobal("useUserStore", () => ({ user: { id: "host-1" } }));

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

function stubServer(freshIds: string[]) {
  vi.stubGlobal("$fetch", async (url: string) => {
    if (url === "/api/lobby/by-code/ABCD") return { id: "lobby-uuid" };
    if (url === "/api/game/draw-cards") {
      return {
        success: true,
        cardIds: freshIds,
        // The route still returns texts; the engine must ignore them.
        cardTexts: Object.fromEntries(
          freshIds.map((id) => [id, { text: `Text for ${id}`, pack: "base" }]),
        ),
      };
    }
    throw new Error(`unexpected url ${url}`);
  });
}

function seedStartedGame(stub: LobbyDocResult) {
  const cards = stub.getCards();
  cards.set("whiteDeck", JSON.stringify(["existing-1"]));
  cards.set("discardWhite", "[]");
  cards.set("blackDeck", "[]");
  cards.set("discardBlack", "[]");
  // Black texts only, chunked exactly as startGame writes them.
  cards.set(
    "cardTexts_0",
    JSON.stringify({ "black-1": { text: "A prompt", pack: "base", pick: 1 } }),
  );
  cards.set("cardTextsChunks", "1");
  stub.getSettings().set("cardPacks", JSON.stringify(["base"]));
  stub.getMeta().set("hostUserId", "host-1");
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("useUserStore", () => ({ user: { id: "host-1" } }));
});

describe("useYjsGameEngine.replenishWhiteDeck", () => {
  it("appends the fresh card ids to the white deck", async () => {
    const stub = makeStubDoc();
    seedStartedGame(stub);
    stubServer(["fresh-1", "fresh-2"]);

    const engine = useYjsGameEngine(stub);
    await engine.replenishWhiteDeck(2);

    const deck = JSON.parse(stub.getCards().get("whiteDeck") as string);
    expect(deck).toEqual(["existing-1", "fresh-1", "fresh-2"]);
  });

  it("does not write card texts into the Y.Doc", async () => {
    const stub = makeStubDoc();
    seedStartedGame(stub);
    stubServer(["fresh-1", "fresh-2"]);

    const engine = useYjsGameEngine(stub);
    await engine.replenishWhiteDeck(2);

    // Rewriting the whole flat blob on every replenish grew it without bound
    // until a single Y.Doc update crossed Teleportal's ~64KB limit and was
    // silently dropped. White texts are resolved per client instead.
    const flat = stub.getCards().get("cardTexts");
    const parsed = flat ? JSON.parse(flat as string) : {};
    expect(parsed["fresh-1"]).toBeUndefined();
    expect(parsed["fresh-2"]).toBeUndefined();
  });

  it("leaves the black-card texts written at game start untouched", async () => {
    const stub = makeStubDoc();
    seedStartedGame(stub);
    stubServer(["fresh-1"]);

    const engine = useYjsGameEngine(stub);
    await engine.replenishWhiteDeck(1);

    const chunk = JSON.parse(stub.getCards().get("cardTexts_0") as string);
    expect(chunk["black-1"].text).toBe("A prompt");
  });
});

describe("useYjsGameEngine.convertToPlayer", () => {
  function seedSpectator(stub: LobbyDocResult) {
    stub.getMeta().set("hostUserId", "host-1");
    stub.getSettings().set("cardsPerPlayer", 2);
    stub.getCards().set("whiteDeck", JSON.stringify(["w1", "w2", "w3"]));
    stub.getCards().set("discardWhite", "[]");
    stub.getPlayers().set(
      "watcher-1",
      JSON.stringify({ userId: "watcher-1", name: "Watcher", playerType: "spectator" }),
    );
    stub.getGameState().set("phase", "submitting");
    stub.getGameState().set("scores", JSON.stringify({ "host-1": 0 }));
    stub.getGameState().set("playerOrder", JSON.stringify(["host-1"]));
  }

  it("mirrors the conversion into the players table", async () => {
    const stub = makeStubDoc();
    seedSpectator(stub);
    const calls: { url: string; body: any }[] = [];
    vi.stubGlobal("$fetch", async (url: string, opts: any) => {
      calls.push({ url, body: opts?.body });
      if (url === "/api/lobby/by-code/ABCD") return { id: "lobby-uuid" };
      return { success: true };
    });

    const engine = useYjsGameEngine(stub);
    const result = engine.convertToPlayer("watcher-1");
    expect(result.success).toBe(true);

    // The Y.Doc write is synchronous; the Postgres mirror is fire-and-forget.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(calls).toContainEqual({
      url: "/api/players/convert",
      body: { lobbyId: "lobby-uuid", playerId: "watcher-1" },
    });
  });

  it("does not call the server when the conversion is rejected", async () => {
    const stub = makeStubDoc();
    seedSpectator(stub);
    // Already a player, so convertToPlayer should refuse.
    stub.getPlayers().set(
      "watcher-1",
      JSON.stringify({ userId: "watcher-1", name: "Watcher", playerType: "player" }),
    );
    const calls: string[] = [];
    vi.stubGlobal("$fetch", async (url: string) => {
      calls.push(url);
      return { id: "lobby-uuid" };
    });

    const engine = useYjsGameEngine(stub);
    const result = engine.convertToPlayer("watcher-1");

    expect(result.success).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).not.toContain("/api/players/convert");
  });
});
