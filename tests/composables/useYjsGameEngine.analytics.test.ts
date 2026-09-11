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

type RoundStats = {
  lobbyId: string;
  blackCardId: string | null;
  playedWhiteIds: string[];
  wonWhiteIds: string[];
};

/** Captures what the engine posts to /api/game/record-round. */
function stubFetch(): { calls: RoundStats[] } {
  const calls: RoundStats[] = [];
  vi.stubGlobal("$fetch", async (url: string, opts?: any) => {
    if (url.startsWith("/api/lobby/by-code/")) return { id: "lobby-uuid-1" };
    if (url === "/api/game/record-round") {
      calls.push(opts.body);
      return { success: true };
    }
    return null;
  });
  return { calls };
}

/**
 * A game sitting in judging with submissions on the table.
 * `types` maps a player id to its playerType so bots can be seeded.
 */
function seedJudging(
  stub: LobbyDocResult,
  opts: {
    judgeId: string;
    submissions: Record<string, string[]>;
    types?: Record<string, string>;
    blackCardId?: string | null;
  },
) {
  stub.getMeta().set("hostUserId", "host-1");

  const settings = stub.getSettings();
  settings.set("cardPacks", JSON.stringify(["base"]));
  settings.set("maxPoints", 10);

  const players = stub.getPlayers();
  const ids = new Set([opts.judgeId, ...Object.keys(opts.submissions)]);
  for (const id of ids) {
    players.set(
      id,
      JSON.stringify({
        userId: id,
        name: id,
        playerType: opts.types?.[id] ?? "player",
      }),
    );
  }

  const cards = stub.getCards();
  cards.set("whiteDeck", JSON.stringify(["w-spare"]));
  cards.set("discardWhite", "[]");
  cards.set("discardBlack", "[]");
  cards.set("blackDeck", "[]");

  const gs = stub.getGameState();
  gs.set("phase", "judging");
  gs.set("round", 1);
  gs.set("judgeId", opts.judgeId);
  gs.set("playerOrder", JSON.stringify([...ids]));
  gs.set(
    "scores",
    JSON.stringify(Object.fromEntries([...ids].map((id) => [id, 0]))),
  );
  gs.set("submissions", JSON.stringify(opts.submissions));
  gs.set("revealedCards", "{}");
  gs.set("skippedPlayers", "[]");
  gs.set(
    "blackCard",
    JSON.stringify({
      id: opts.blackCardId === undefined ? "black-1" : opts.blackCardId,
      pick: 1,
    }),
  );
  gs.set("config", JSON.stringify({ maxPoints: 10 }));
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("useUserStore", () => ({ user: { id: "judge-1" } }));
});

describe("useYjsGameEngine round stats reporting", () => {
  it("reports every submitted card as played and the winner's as won", async () => {
    const { calls } = stubFetch();
    const stub = makeStubDoc();
    seedJudging(stub, {
      judgeId: "judge-1",
      submissions: { "p-2": ["w1", "w2"], "p-3": ["w3"] },
    });

    const engine = useYjsGameEngine(stub);
    engine.selectWinner("p-3");

    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.lobbyId).toBe("lobby-uuid-1");
    expect(calls[0]!.blackCardId).toBe("black-1");
    expect([...calls[0]!.playedWhiteIds].sort()).toEqual(["w1", "w2", "w3"]);
    expect(calls[0]!.wonWhiteIds).toEqual(["w3"]);
  });

  it("reports nothing from a client that is not the judge", async () => {
    vi.stubGlobal("useUserStore", () => ({ user: { id: "p-2" } }));
    const { calls } = stubFetch();
    const stub = makeStubDoc();
    seedJudging(stub, {
      judgeId: "judge-1",
      submissions: { "p-2": ["w1"], "p-3": ["w3"] },
    });

    const engine = useYjsGameEngine(stub);
    const result = engine.selectWinner("p-3");

    expect(result.success).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(0);
  });

  // A bot judge means useBots drove selectWinner from the host's client, so
  // myId() is the host and the judge check already suppresses the report.
  it("reports nothing for a round judged by a bot", async () => {
    vi.stubGlobal("useUserStore", () => ({ user: { id: "host-1" } }));
    const { calls } = stubFetch();
    const stub = makeStubDoc();
    seedJudging(stub, {
      judgeId: "bot-1",
      submissions: { "host-1": ["w1"], "p-3": ["w3"] },
      types: { "bot-1": "bot" },
    });

    const engine = useYjsGameEngine(stub);
    engine.selectWinner("p-3");

    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(0);
  });

  it("excludes cards a bot played from the played list", async () => {
    const { calls } = stubFetch();
    const stub = makeStubDoc();
    seedJudging(stub, {
      judgeId: "judge-1",
      submissions: { "p-2": ["w1"], "bot-9": ["w-bot"] },
      types: { "bot-9": "bot" },
    });

    const engine = useYjsGameEngine(stub);
    engine.selectWinner("p-2");

    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.playedWhiteIds).toEqual(["w1"]);
    expect(calls[0]!.wonWhiteIds).toEqual(["w1"]);
  });

  it("credits no win when a bot takes the round, but still counts human plays", async () => {
    const { calls } = stubFetch();
    const stub = makeStubDoc();
    seedJudging(stub, {
      judgeId: "judge-1",
      submissions: { "p-2": ["w1"], "bot-9": ["w-bot"] },
      types: { "bot-9": "bot" },
    });

    const engine = useYjsGameEngine(stub);
    engine.selectWinner("bot-9");

    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.playedWhiteIds).toEqual(["w1"]);
    expect(calls[0]!.wonWhiteIds).toEqual([]);
  });

  it("reports nothing when selectWinner is rejected", async () => {
    const { calls } = stubFetch();
    const stub = makeStubDoc();
    seedJudging(stub, {
      judgeId: "judge-1",
      submissions: { "p-2": ["w1"] },
    });
    stub.getGameState().set("phase", "submitting");

    const engine = useYjsGameEngine(stub);
    const result = engine.selectWinner("p-2");

    expect(result.success).toBe(false);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(0);
  });

  it("skips the report when every submission came from bots", async () => {
    vi.stubGlobal("useUserStore", () => ({ user: { id: "judge-1" } }));
    const { calls } = stubFetch();
    const stub = makeStubDoc();
    seedJudging(stub, {
      judgeId: "judge-1",
      submissions: { "bot-9": ["w-bot"] },
      types: { "bot-9": "bot" },
    });

    const engine = useYjsGameEngine(stub);
    engine.selectWinner("bot-9");

    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(0);
  });

  it("still awards the round when the stats call fails", async () => {
    vi.stubGlobal("$fetch", async () => {
      throw new Error("network down");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const stub = makeStubDoc();
    seedJudging(stub, {
      judgeId: "judge-1",
      submissions: { "p-2": ["w1"] },
    });

    const engine = useYjsGameEngine(stub);
    const result = engine.selectWinner("p-2");

    expect(result.success).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    const scores = JSON.parse(
      stub.getGameState().get("scores") as string,
    ) as Record<string, number>;
    expect(scores["p-2"]).toBe(1);
    warn.mockRestore();
  });
});

describe("useYjsGameEngine.resetGame", () => {
  it("clears the gameId so the next game cannot inherit it", () => {
    const stub = makeStubDoc();
    seedJudging(stub, { judgeId: "judge-1", submissions: { "p-2": ["w1"] } });
    stub.getGameState().set("gameId", "11111111-1111-4111-8111-111111111111");

    useYjsGameEngine(stub).resetGame();

    expect(stub.getGameState().get("gameId")).toBeNull();
  });
});
