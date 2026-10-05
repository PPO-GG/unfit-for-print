// Bots acting on /api/bot/decide. Built like useBots.skipPrompt.test.ts: the
// module is re-imported per test because its in-flight bookkeeping is
// module-level, and fake timers drive the bot delays.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computed, nextTick, ref, type Ref } from "vue";
import type { GameState } from "~/types/game";

const playCard = vi.fn(() => ({ success: true }));
const readHand = vi.fn(() => ["w-1", "w-2", "w-3"]);
const revealCard = vi.fn(() => ({ success: true }));
const selectWinner = vi.fn(() => ({ success: true }));
const activityFetch = vi.fn();

const botPlayer = { userId: "bot-1", playerType: "bot", name: "Bot 1" };

let state: Ref<Partial<GameState> | null> = ref(null);

Object.assign(globalThis, {
  useToast: () => ({ add: vi.fn() }),
  useLobbyDoc: () => ({
    doc: ref({}),
    getPlayers: () => new Map([["bot-1", JSON.stringify({ name: "Bot 1" })]]),
  }),
  useLobbyMutations: () => ({ addPlayer: vi.fn(), removePlayer: vi.fn() }),
  useYjsGameEngine: () => ({ playCard, readHand, revealCard, selectWinner }),
  useLobbyReactive: () => {
    const own = state;
    return {
      isHost: computed(() => true),
      isWaiting: computed(() => false),
      playerList: computed(() => [botPlayer]),
      gameState: computed(() => own.value),
    };
  },
  useNuxtApp: () => ({ $activityFetch: activityFetch }),
});

const BOT_DELAY_MS = 2500; // round > 1 settle delay in useBots
// INITIAL 1500 + two reveals x 1200 + THINKING 2000
const JUDGE_DONE_MS = 1500 + 2 * 1200 + 2000;

const submitting = (over: Partial<GameState> = {}): Partial<GameState> => ({
  phase: "submitting",
  round: 3,
  judgeId: "human-judge",
  submissions: {},
  promptSerial: 4,
  blackCard: { id: "b-1", text: "Why _?", pick: 1 },
  ...over,
});

const judging = (over: Partial<GameState> = {}): Partial<GameState> => ({
  phase: "judging",
  round: 3,
  judgeId: "bot-1",
  submissions: { "p-1": ["w-1"], "p-2": ["w-2"] },
  revealedCards: {},
  promptSerial: 4,
  blackCard: { id: "b-1", text: "Why _?", pick: 1 },
  ...over,
});

/** Resolves `value` after `ms` of fake time — a slow /api/bot/decide. */
const after = <T>(ms: number, value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

let start: () => void;

beforeEach(async () => {
  vi.useFakeTimers();
  for (const fn of [playCard, readHand, revealCard, selectWinner, activityFetch]) {
    fn.mockClear();
  }
  activityFetch.mockReset();
  readHand.mockImplementation(() => ["w-1", "w-2", "w-3"]);
  state = ref(null);

  vi.resetModules();
  const { useBots } = await import("~/composables/useBots");
  start = () =>
    void useBots(
      ref({ id: "lobby-1", status: "playing" } as any),
      ref([botPlayer] as any),
      computed(() => true),
    );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function push(next: Partial<GameState>) {
  state.value = next;
  await nextTick();
}

describe("useBots — playing with /api/bot/decide", () => {
  it("asks the server and plays the cards it chose", async () => {
    activityFetch.mockResolvedValue({ cardIds: ["w-3"] });
    start();
    await push(submitting());

    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS + 500);

    expect(activityFetch).toHaveBeenCalledWith("/api/bot/decide", {
      method: "POST",
      body: {
        lobbyId: "lobby-1",
        mode: "play",
        blackCardId: "b-1",
        hand: ["w-1", "w-2", "w-3"],
      },
      timeout: 2500,
    });
    expect(playCard).toHaveBeenCalledWith(["w-3"], "bot-1");
  });

  it("falls back to the first cards when the server answers null", async () => {
    activityFetch.mockResolvedValue({ cardIds: null });
    start();
    await push(submitting());
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS + 500);

    expect(playCard).toHaveBeenCalledWith(["w-1"], "bot-1");
  });

  it("falls back when the request fails", async () => {
    activityFetch.mockRejectedValue(new Error("504"));
    start();
    await push(submitting());
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS + 500);

    expect(playCard).toHaveBeenCalledWith(["w-1"], "bot-1");
  });

  it("falls back when the server names a card the bot does not hold", async () => {
    activityFetch.mockResolvedValue({ cardIds: ["w-9"] });
    start();
    await push(submitting());
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS + 500);

    expect(playCard).toHaveBeenCalledWith(["w-1"], "bot-1");
  });

  it("falls back when the server returns the wrong number of cards", async () => {
    activityFetch.mockResolvedValue({ cardIds: ["w-2"] });
    start();
    await push(submitting({ blackCard: { id: "b-2", text: "_ + _", pick: 2 } }));
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS + 500);

    expect(playCard).toHaveBeenCalledWith(["w-1", "w-2"], "bot-1");
  });

  it("accepts fewer cards than the prompt asks for when the hand is short", async () => {
    readHand.mockImplementation(() => ["w-1", "w-2"]);
    activityFetch.mockResolvedValue({ cardIds: ["w-2", "w-1"] });
    start();
    await push(submitting({ blackCard: { id: "b-3", text: "_, _, _", pick: 3 } }));
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS + 500);

    expect(playCard).toHaveBeenCalledWith(["w-2", "w-1"], "bot-1");
  });

  it("drops the play when the prompt is skipped while waiting on the server", async () => {
    activityFetch.mockImplementation(() => after(1000, { cardIds: ["w-3"] }));
    start();
    await push(submitting());

    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS + 10); // timer fired, awaiting
    expect(activityFetch).toHaveBeenCalledTimes(1);
    await push(
      submitting({ promptSerial: 5, blackCard: { id: "b-new", text: "New _", pick: 1 } }),
    );
    await vi.advanceTimersByTimeAsync(1000); // old request settles

    expect(playCard).not.toHaveBeenCalled();
  });

  it("does not ask twice while a request is still in flight", async () => {
    activityFetch.mockImplementation(() => after(1000, { cardIds: ["w-3"] }));
    start();
    await push(submitting());
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS + 10);

    await push(submitting()); // same moment, fresh object: re-runs the watcher
    await vi.advanceTimersByTimeAsync(1000);

    expect(activityFetch).toHaveBeenCalledTimes(1);
    expect(playCard).toHaveBeenCalledTimes(1);
  });
});

describe("useBots — judging with /api/bot/decide", () => {
  it("asks as judging starts and picks the winner the server chose", async () => {
    activityFetch.mockResolvedValue({ winnerIndex: 1 });
    start();
    await push(judging());
    await vi.advanceTimersByTimeAsync(0);

    expect(activityFetch).toHaveBeenCalledWith("/api/bot/decide", {
      method: "POST",
      body: {
        lobbyId: "lobby-1",
        mode: "judge",
        blackCardId: "b-1",
        submissions: [["w-1"], ["w-2"]],
      },
      timeout: 2500,
    });

    await vi.advanceTimersByTimeAsync(JUDGE_DONE_MS + 100);
    expect(selectWinner).toHaveBeenCalledWith("p-2");
  });

  it("picks at random when the server answers null", async () => {
    activityFetch.mockResolvedValue({ winnerIndex: null });
    vi.spyOn(Math, "random").mockReturnValue(0);
    start();
    await push(judging());
    await vi.advanceTimersByTimeAsync(JUDGE_DONE_MS + 100);

    expect(selectWinner).toHaveBeenCalledWith("p-1");
  });

  it("picks at random among who is left when the chosen submitter has gone", async () => {
    activityFetch.mockImplementation(() => after(JUDGE_DONE_MS - 100, { winnerIndex: 0 }));
    vi.spyOn(Math, "random").mockReturnValue(0);
    start();
    await push(judging());

    // p-1 leaves mid-judging; their submission comes off the table.
    await vi.advanceTimersByTimeAsync(500);
    await push(judging({ submissions: { "p-2": ["w-2"] } }));
    await vi.advanceTimersByTimeAsync(JUDGE_DONE_MS + 100);

    expect(selectWinner).toHaveBeenCalledWith("p-2");
  });

  it("does not pick once the table has left judging", async () => {
    activityFetch.mockImplementation(() => after(JUDGE_DONE_MS + 1000, { winnerIndex: 0 }));
    start();
    await push(judging());

    await vi.advanceTimersByTimeAsync(JUDGE_DONE_MS + 10); // winner timer fired, awaiting
    await push({ ...judging(), phase: "roundEnd" });
    await vi.advanceTimersByTimeAsync(2000);

    expect(selectWinner).not.toHaveBeenCalled();
  });
});
