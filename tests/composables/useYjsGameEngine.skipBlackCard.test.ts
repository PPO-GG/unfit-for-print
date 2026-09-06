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

function stubFetch(): { calls: { lobbyId: string; blackCardId: string }[] } {
  const calls: { lobbyId: string; blackCardId: string }[] = [];
  vi.stubGlobal("$fetch", async (url: string, opts?: any) => {
    if (url.startsWith("/api/lobby/by-code/")) return { id: "lobby-uuid-1" };
    if (url === "/api/game/record-skip") {
      calls.push(opts.body);
      return { success: true };
    }
    return null;
  });
  return { calls };
}

/** A game mid-submission with two answers already on the table. */
function seedSubmitting(
  stub: LobbyDocResult,
  opts: {
    judgeId?: string;
    submissions?: Record<string, string[]>;
    blackDeck?: string[];
    blackCardId?: string;
    blackSkipUsed?: boolean;
    promptSerial?: number;
  } = {},
) {
  const judgeId = opts.judgeId ?? "judge-1";
  const submissions = opts.submissions ?? { "p-2": ["w1", "w2"], "p-3": ["w3"] };

  stub.getMeta().set("hostUserId", "judge-1");

  const settings = stub.getSettings();
  settings.set("maxPick", 3);
  settings.set("cardsPerPlayer", 10);

  const players = stub.getPlayers();
  for (const id of new Set([judgeId, ...Object.keys(submissions)])) {
    players.set(id, JSON.stringify({ userId: id, name: id, playerType: "player" }));
  }

  const hands = stub.getHands();
  hands.set(judgeId, JSON.stringify([]));
  for (const pid of Object.keys(submissions)) {
    hands.set(pid, JSON.stringify(["keep-1"]));
  }

  const cards = stub.getCards();
  cards.set("whiteDeck", JSON.stringify(["w-spare"]));
  cards.set("discardWhite", "[]");
  cards.set("discardBlack", "[]");
  cards.set("blackDeck", JSON.stringify(opts.blackDeck ?? ["b-next"]));
  cards.set("blackPicks", JSON.stringify({ "b-next": 1 }));

  const gs = stub.getGameState();
  gs.set("phase", "submitting");
  gs.set("round", 4);
  gs.set("judgeId", judgeId);
  gs.set("playerOrder", JSON.stringify([judgeId, ...Object.keys(submissions)]));
  gs.set("scores", JSON.stringify({ [judgeId]: 2 }));
  gs.set("submissions", JSON.stringify(submissions));
  gs.set("revealedCards", JSON.stringify({ "p-2": true }));
  gs.set("skippedPlayers", JSON.stringify(["p-9"]));
  gs.set("readAloudText", "some text");
  gs.set(
    "blackCard",
    JSON.stringify({ id: opts.blackCardId ?? "b-old", pick: 1 }),
  );
  if (opts.blackSkipUsed !== undefined) {
    gs.set("blackSkipUsed", JSON.stringify(opts.blackSkipUsed));
  }
  if (opts.promptSerial !== undefined) {
    gs.set("promptSerial", opts.promptSerial);
  }
}

const gsRead = <T>(stub: LobbyDocResult, key: string, fallback: T): T => {
  const raw = stub.getGameState().get(key);
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "string") return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Some gameState fields (judgeId, readAloudText) are stored as raw
    // strings rather than JSON, so a parse failure means "take it literally"
    // rather than "fall back" — otherwise "judge-1" or "" could never round-trip.
    return raw as unknown as T;
  }
};

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("useUserStore", () => ({ user: { id: "judge-1" } }));
});

describe("useYjsGameEngine.skipBlackCard", () => {
  it("swaps in the next eligible black card", () => {
    stubFetch();
    const stub = makeStubDoc();
    seedSubmitting(stub);

    const result = useYjsGameEngine(stub).skipBlackCard();

    expect(result.success).toBe(true);
    expect(gsRead(stub, "blackCard", null)).toEqual({ id: "b-next", pick: 1 });
  });

  it("returns every submitted card to its owner's hand", () => {
    stubFetch();
    const stub = makeStubDoc();
    seedSubmitting(stub);

    useYjsGameEngine(stub).skipBlackCard();

    const hands = stub.getHands();
    expect(JSON.parse(hands.get("p-2") as string).sort()).toEqual(
      ["keep-1", "w1", "w2"].sort(),
    );
    expect(JSON.parse(hands.get("p-3") as string).sort()).toEqual(
      ["keep-1", "w3"].sort(),
    );
    expect(gsRead(stub, "submissions", null)).toEqual({});
  });

  it("clears per-prompt state but leaves the round alone", () => {
    stubFetch();
    const stub = makeStubDoc();
    seedSubmitting(stub);

    useYjsGameEngine(stub).skipBlackCard();

    expect(gsRead(stub, "revealedCards", null)).toEqual({});
    expect(gsRead(stub, "readAloudText", "x")).toBe("");
    // Same round, same judge, same scores, same skipped players.
    expect(gsRead(stub, "round", 0)).toBe(4);
    expect(gsRead(stub, "judgeId", "")).toBe("judge-1");
    expect(gsRead(stub, "scores", null)).toEqual({ "judge-1": 2 });
    expect(gsRead(stub, "skippedPlayers", null)).toEqual(["p-9"]);
  });

  it("bumps promptSerial and marks the skip used", () => {
    stubFetch();
    const stub = makeStubDoc();
    seedSubmitting(stub, { promptSerial: 7 });

    useYjsGameEngine(stub).skipBlackCard();

    expect(gsRead(stub, "promptSerial", 0)).toBe(8);
    expect(gsRead(stub, "blackSkipUsed", false)).toBe(true);
  });

  it("starts promptSerial at 1 on a legacy doc that has no serial", () => {
    stubFetch();
    const stub = makeStubDoc();
    seedSubmitting(stub);

    useYjsGameEngine(stub).skipBlackCard();

    expect(gsRead(stub, "promptSerial", 0)).toBe(1);
  });

  it("discards the card it skipped", () => {
    stubFetch();
    const stub = makeStubDoc();
    seedSubmitting(stub);

    useYjsGameEngine(stub).skipBlackCard();

    expect(JSON.parse(stub.getCards().get("discardBlack") as string)).toContain(
      "b-old",
    );
  });

  it("does not discard the exhausted-deck sentinel", () => {
    stubFetch();
    const stub = makeStubDoc();
    seedSubmitting(stub, { blackCardId: "" });

    useYjsGameEngine(stub).skipBlackCard();

    expect(JSON.parse(stub.getCards().get("discardBlack") as string)).toEqual([]);
  });

  it("rejects a player who is not the judge", () => {
    vi.stubGlobal("useUserStore", () => ({ user: { id: "p-2" } }));
    stubFetch();
    const stub = makeStubDoc();
    seedSubmitting(stub);

    const result = useYjsGameEngine(stub).skipBlackCard();

    expect(result.success).toBe(false);
    expect(gsRead(stub, "blackCard", null)).toEqual({ id: "b-old", pick: 1 });
  });

  it("rejects a skip outside the submitting phase", () => {
    stubFetch();
    const stub = makeStubDoc();
    seedSubmitting(stub);
    stub.getGameState().set("phase", "judging");

    expect(useYjsGameEngine(stub).skipBlackCard().success).toBe(false);
  });

  it("rejects a second skip in the same round", () => {
    stubFetch();
    const stub = makeStubDoc();
    seedSubmitting(stub, { blackSkipUsed: true });

    expect(useYjsGameEngine(stub).skipBlackCard().success).toBe(false);
  });

  it("rejects the skip when no replacement card is available", () => {
    stubFetch();
    const stub = makeStubDoc();
    seedSubmitting(stub, { blackDeck: [] });

    const result = useYjsGameEngine(stub).skipBlackCard();

    expect(result.success).toBe(false);
    expect(gsRead(stub, "blackCard", null)).toEqual({ id: "b-old", pick: 1 });
    // Nothing was half-applied.
    expect(gsRead(stub, "submissions", null)).toEqual({
      "p-2": ["w1", "w2"],
      "p-3": ["w3"],
    });
  });

  it("swaps to another eligible discarded card, never the one just skipped", () => {
    // Regression for a real bug: pushing the outgoing card into discardBlack
    // BEFORE drawing lets an empty-deck reshuffle deal it straight back out,
    // even when a perfectly good replacement is sitting right next to it in
    // the discard pile. With blackDeck empty and exactly one other candidate
    // in discardBlack, the result can't depend on shuffle order — there is
    // only one card to draw. The skip must succeed and hand back that other
    // card, not "b-old", and "b-old" must end up in the discard pile after.
    stubFetch();
    const stub = makeStubDoc();
    seedSubmitting(stub, { blackDeck: [] });
    stub.getCards().set("discardBlack", JSON.stringify(["b-other"]));
    stub.getCards().set("blackPicks", JSON.stringify({ "b-other": 1 }));

    const result = useYjsGameEngine(stub).skipBlackCard();

    expect(result.success).toBe(true);
    expect(gsRead(stub, "blackCard", null)).toEqual({ id: "b-other", pick: 1 });
    expect(JSON.parse(stub.getCards().get("discardBlack") as string)).toContain(
      "b-old",
    );
  });

  it("reports the skipped card to the server", async () => {
    const { calls } = stubFetch();
    const stub = makeStubDoc();
    seedSubmitting(stub);

    useYjsGameEngine(stub).skipBlackCard();

    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ lobbyId: "lobby-uuid-1", blackCardId: "b-old" });
  });

  it("reports nothing when the skipped card was the sentinel", async () => {
    const { calls } = stubFetch();
    const stub = makeStubDoc();
    seedSubmitting(stub, { blackCardId: "" });

    useYjsGameEngine(stub).skipBlackCard();

    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(0);
  });

  it("still swaps the card when the report fails", async () => {
    vi.stubGlobal("$fetch", async () => {
      throw new Error("network down");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const stub = makeStubDoc();
    seedSubmitting(stub);

    expect(useYjsGameEngine(stub).skipBlackCard().success).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(gsRead(stub, "blackCard", null)).toEqual({ id: "b-next", pick: 1 });
    warn.mockRestore();
  });
});
