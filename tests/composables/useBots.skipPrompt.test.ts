// Bots vs. a skipped prompt.
//
// A prompt skip deliberately leaves `round`, `judgeId` and `phase` alone — it
// is the same round with a different card. The bot driver keyed everything on
// `round`, so after a skip:
//
//   - the pending submit timers were never cancelled (the branch that clears
//     them only runs when the phase leaves "submitting", which a skip does not
//     do), and
//   - `botActionsInFlight` still held `play-<bot>-<round>`, so the re-schedule
//     pass declined to arm a fresh timer.
//
// The bot therefore rode its old countdown and dropped a card on the table the
// instant the judge skipped — which reads, from the judge's seat, as the skip
// not having worked.

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { computed, nextTick, ref, type Ref } from "vue";
import type { GameState } from "~/types/game";

const playCard = vi.fn(() => ({ success: true }));
const readHand = vi.fn(() => ["w-1", "w-2", "w-3"]);

const botPlayer = { userId: "bot-1", playerType: "bot", name: "Bot 1" };

// Re-pointed for every test. The globals below read it at call time, so a
// composable built in an earlier test keeps its own ref and cannot react to
// the next test's state.
let state: Ref<Partial<GameState> | null> = ref(null);

Object.assign(globalThis, {
  useToast: () => ({ add: vi.fn() }),
  useLobbyDoc: () => ({
    doc: ref({}),
    getPlayers: () => new Map([["bot-1", JSON.stringify({ name: "Bot 1" })]]),
  }),
  useLobbyMutations: () => ({ addPlayer: vi.fn(), removePlayer: vi.fn() }),
  useYjsGameEngine: () => ({ playCard, readHand }),
  useLobbyReactive: () => {
    const own = state;
    return {
      isHost: computed(() => true),
      isWaiting: computed(() => false),
      playerList: computed(() => [botPlayer]),
      gameState: computed(() => own.value),
    };
  },
  useNuxtApp: () => ({ $activityFetch: vi.fn() }),
});

// Round 3, not round 1: the bot driver only applies its 2500ms settle delay
// from round 2 on (round 1 fires immediately), and that delay is the window a
// skip lands in.
const BOT_DELAY_MS = 2500;

/** Mid-submission: one bot yet to answer, judge is a human. */
const submitting = (over: Partial<GameState> = {}): Partial<GameState> => ({
  phase: "submitting",
  round: 3,
  judgeId: "human-judge",
  submissions: {},
  promptSerial: 4,
  blackCard: { id: "b-old", text: "old prompt", pick: 1 },
  ...over,
});

// useBots keeps `botActionsInFlight` and `pendingBotTimers` as module-level
// singletons shared by every instance, so the module has to be rebuilt per
// test or one test's in-flight keys suppress the next test's scheduling.
let start: () => void;

beforeEach(async () => {
  vi.useFakeTimers();
  playCard.mockClear();
  readHand.mockClear();
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
});

/** Push new game state and let Vue's watchers (microtask-flushed) run. */
async function push(next: Partial<GameState>) {
  state.value = next;
  await nextTick();
}

describe("useBots — prompt skipped mid-submission", () => {
  it("submits normally when nothing interrupts the round", async () => {
    start();
    await push(submitting());

    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS + 500);

    expect(playCard).toHaveBeenCalledTimes(1);
    expect(playCard).toHaveBeenCalledWith(["w-1"], "bot-1");
  });

  it("does not let a pre-skip countdown land a card on the new prompt", async () => {
    start();
    await push(submitting());

    // With the countdown nearly expired, the judge skips: same round, same
    // phase, cleared board, new prompt.
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS - 100);
    expect(playCard).not.toHaveBeenCalled(); // premise: it had not fired yet
    await push(
      submitting({
        promptSerial: 5,
        blackCard: { id: "b-new", text: "new prompt", pick: 1 },
      }),
    );

    // Past the moment the old countdown would have expired.
    await vi.advanceTimersByTimeAsync(300);
    expect(playCard).not.toHaveBeenCalled();
  });

  it("gives the bot a fresh delay against the new prompt", async () => {
    start();
    await push(submitting());
    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS - 100);
    await push(
      submitting({
        promptSerial: 5,
        blackCard: { id: "b-new", text: "new prompt", pick: 1 },
      }),
    );

    await vi.advanceTimersByTimeAsync(BOT_DELAY_MS + 500);

    // Re-armed, not abandoned: the round is still live and the bot still owes
    // an answer — just to the card now on the table.
    expect(playCard).toHaveBeenCalledTimes(1);
  });
});
