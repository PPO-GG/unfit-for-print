import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";
import { shallowRef, ref, nextTick } from "vue";
import { useCardTexts } from "~/composables/useCardTexts";
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
  } as unknown as LobbyDocResult;
}

/** Records every /api/cards/resolve call and answers from a fixed catalogue. */
function stubResolveEndpoint(catalogue: Record<string, string>) {
  const requestedBatches: string[][] = [];
  vi.stubGlobal("$fetch", async (url: string, opts: any) => {
    if (url !== "/api/cards/resolve") throw new Error(`unexpected url ${url}`);
    const ids: string[] = opts.body.ids;
    requestedBatches.push([...ids]);
    return ids
      .filter((id) => catalogue[id] !== undefined)
      .map((id) => ({ id, text: catalogue[id], pack: "base" }));
  });
  return requestedBatches;
}

/** Lets the composable's watcher fire and its fetch settle. */
async function settle() {
  await nextTick();
  await new Promise((r) => setTimeout(r, 0));
  await nextTick();
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("useCardTexts", () => {
  it("passes through texts already embedded in the Y.Doc", async () => {
    const stub = makeStubDoc();
    stub.getCards().set(
      "cardTexts",
      JSON.stringify({
        "black-1": { text: "Why am I sticky?", pack: "base", pick: 1 },
      }),
    );
    stubResolveEndpoint({});

    const { cardTexts } = useCardTexts(stub, ref([]));
    await settle();

    expect(cardTexts.value["black-1"]?.text).toBe("Why am I sticky?");
  });

  it("resolves ids that are missing from the Y.Doc", async () => {
    const stub = makeStubDoc();
    stubResolveEndpoint({ "white-1": "A cool ranch Dorito" });

    const { cardTexts } = useCardTexts(stub, ref(["white-1"]));
    await settle();

    expect(cardTexts.value["white-1"]?.text).toBe("A cool ranch Dorito");
  });

  it("does not re-request an id it has already resolved", async () => {
    const stub = makeStubDoc();
    const batches = stubResolveEndpoint({
      "white-1": "First card",
      "white-2": "Second card",
    });
    const needed = ref(["white-1"]);

    const { cardTexts } = useCardTexts(stub, needed);
    await settle();

    needed.value = ["white-1", "white-2"];
    await settle();

    expect(cardTexts.value["white-2"]?.text).toBe("Second card");
    expect(batches).toEqual([["white-1"], ["white-2"]]);
  });

  it("never asks the server for an id the Y.Doc already carries", async () => {
    const stub = makeStubDoc();
    stub
      .getCards()
      .set(
        "cardTexts",
        JSON.stringify({ "black-1": { text: "Embedded", pack: "base" } }),
      );
    const batches = stubResolveEndpoint({});

    useCardTexts(stub, ref(["black-1"]));
    await settle();

    expect(batches).toEqual([]);
  });

  it("keeps resolved texts when the doc's own texts change", async () => {
    const stub = makeStubDoc();
    stubResolveEndpoint({ "white-1": "Resolved once" });

    const { cardTexts } = useCardTexts(stub, ref(["white-1"]));
    await settle();

    // A later replenish/round writes new black texts into the doc.
    stub
      .getCards()
      .set(
        "cardTexts",
        JSON.stringify({ "black-9": { text: "A new prompt", pack: "base" } }),
      );
    await settle();

    expect(cardTexts.value["white-1"]?.text).toBe("Resolved once");
    expect(cardTexts.value["black-9"]?.text).toBe("A new prompt");
  });
});

describe("useCardTexts black cards", () => {
  it("resolves black ids as black so the route returns their pick", async () => {
    const stub = makeStubDoc();
    const requests: { ids: string[]; type?: string }[] = [];
    vi.stubGlobal("$fetch", async (_url: string, opts: any) => {
      requests.push({ ids: opts.body.ids, type: opts.body.type });
      return opts.body.ids.map((id: string) => ({
        id,
        text: "A prompt",
        pack: "base",
        pick: 2,
      }));
    });

    const { cardTexts } = useCardTexts(stub, ref([]), ref(["black-1"]));
    await settle();

    expect(requests).toEqual([{ ids: ["black-1"], type: "black" }]);
    expect(cardTexts.value["black-1"]?.text).toBe("A prompt");
  });

  it("keeps white and black ids in separate requests", async () => {
    const stub = makeStubDoc();
    const requests: { ids: string[]; type?: string }[] = [];
    vi.stubGlobal("$fetch", async (_url: string, opts: any) => {
      requests.push({ ids: opts.body.ids, type: opts.body.type });
      return opts.body.ids.map((id: string) => ({ id, text: id, pack: "base" }));
    });

    useCardTexts(stub, ref(["white-1"]), ref(["black-1"]));
    await settle();

    expect(requests).toContainEqual({ ids: ["white-1"], type: undefined });
    expect(requests).toContainEqual({ ids: ["black-1"], type: "black" });
  });
});
