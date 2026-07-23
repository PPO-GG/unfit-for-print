// tests/components/game/GameBoard.test.ts
//
// Regression test for GitHub issue #99: when the host is the judge and uses
// host tools to skip the judge, the game soft-locks in the "roundEnd" phase
// and can never advance.
//
// Root cause: GameBoard.vue only ever scheduled the auto-advance to the next
// round from inside `watch(() => state.value?.roundWinner, ...)`, gated on
// `if (newWinner)`. useYjsGameEngine.skipJudge() moves the phase to
// "roundEnd" but explicitly sets roundWinner to null, so that watcher never
// fires its advance logic — nothing ever calls engine.nextRound() and the
// round-end celebration/continue UI (gated on the same flag) never appears.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import * as Vue from "vue";
import { ref, computed } from "vue";

// GameBoard.vue relies on Nuxt's auto-import of Vue reactivity APIs (ref,
// computed, watch, onMounted, onUnmounted, ...) inside <script setup> —
// there are no explicit `import { ref } from "vue"` statements in the file.
// Plain vitest (no Nuxt auto-import plugin) compiles that to bare global
// calls, so they must be shimmed as globals here.
Object.assign(globalThis, Vue);

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));
vi.mock("gsap", () => ({ gsap: { to: vi.fn(), set: vi.fn(), fromTo: vi.fn() } }));

vi.mock("@vueuse/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  return {
    ...actual,
    // Force desktop layout so we exercise the WinnerCelebration/GameTable
    // path (gated on winnerSelected) rather than the mobile action bar,
    // which already has a phase-based "Continue" fallback.
    useBreakpoints: () => ({ smaller: () => ref(false) }),
  };
});

// GameBoard.vue calls useI18n()/useSfx() as bare Nuxt auto-imports (no
// explicit import statements), so they must exist as globals under plain
// vitest (no Nuxt auto-import plugin configured for tests).
(globalThis as any).useI18n = () => ({ t: (key: string) => key });
const playSfx = vi.fn();
(globalThis as any).useSfx = () => ({ playSfx });

const nextRound = vi.fn(() => ({ success: true }));
const engineMock = {
  selectWinner: vi.fn(),
  nextRound,
  revealCard: vi.fn(),
  playCard: vi.fn(),
  setReadAloud: vi.fn(),
  convertToPlayer: vi.fn(),
  drawCards: vi.fn(),
};

// Minimal controllable Y.Doc-backed game state stand-in.
const gameState = ref<{ phase: string; roundWinner: string | null; round: number }>(
  { phase: "judging", roundWinner: null, round: 1 },
);

vi.mock("~/composables/useLobby", () => ({
  useLobby: () => ({
    leaveLobby: vi.fn(),
    engine: engineMock,
    reactive: {
      gameState,
      isSubmitting: computed(() => gameState.value.phase === "submitting"),
      isJudging: computed(() => gameState.value.phase === "judging"),
      isRoundEnd: computed(() => gameState.value.phase === "roundEnd"),
      isComplete: computed(() => gameState.value.phase === "complete"),
      isJudge: computed(() => false),
      isHost: computed(() => true),
      myHand: computed(() => []),
      mySubmission: computed(() => null),
      leaderboard: computed(() => []),
      cardTexts: computed(() => ({})),
      settings: computed(() => ({})),
    },
  }),
}));

vi.mock("~/composables/useNotifications", () => ({
  useNotifications: () => ({ notify: vi.fn() }),
}));

vi.mock("~/composables/useSpeech", () => ({
  useSpeech: () => ({ speak: vi.fn(), isSpeaking: ref(false) }),
}));

vi.unmock("vue");

import GameBoard from "~/components/game/GameBoard.vue";
import { useUserStore } from "~/stores/userStore";

const GLOBAL_STUBS = {
  GameChatOverlay: true,
  CornerControls: true,
  GameEscMenu: true,
  MobileGameLayout: true,
  GameHeader: true,
  BlackCardDeck: true,
  WhiteCardDeck: true,
  GameTable: true,
};

describe("GameBoard.vue — skip-judge soft lock (issue #99)", () => {
  let wrapper: ReturnType<typeof mount> | null = null;

  beforeEach(() => {
    setActivePinia(createPinia());
    const userStore = useUserStore();
    userStore.user = { $id: "host-1" } as any;

    vi.clearAllMocks();
    vi.useFakeTimers();
    gameState.value = { phase: "judging", roundWinner: null, round: 1 };
  });

  afterEach(() => {
    // Each mounted instance keeps its own watchers alive on the shared
    // `gameState` ref until unmounted — leaving a prior test's instance
    // mounted would let it react to the next test's state changes too.
    wrapper?.unmount();
    wrapper = null;
    vi.useRealTimers();
  });

  it("auto-advances out of roundEnd when the judge is skipped (no winner)", async () => {
    wrapper = mount(GameBoard, {
      props: { lobby: { $id: "lobby1", code: "ABCD" } as any, players: [] },
      global: { stubs: GLOBAL_STUBS },
    });

    // Simulate useYjsGameEngine.skipJudge(): phase -> roundEnd, no winner.
    gameState.value = { ...gameState.value, phase: "roundEnd", roundWinner: null };
    await wrapper.vm.$nextTick();

    // Before the fix, nothing ever scheduled a call to engine.nextRound()
    // here because the roundWinner watcher requires a truthy winner.
    await vi.advanceTimersByTimeAsync(5000);

    expect(nextRound).toHaveBeenCalledTimes(1);
  });

  it("still advances normally when a winner is selected", async () => {
    wrapper = mount(GameBoard, {
      props: { lobby: { $id: "lobby1", code: "ABCD" } as any, players: [] },
      global: { stubs: GLOBAL_STUBS },
    });

    gameState.value = { ...gameState.value, phase: "roundEnd", roundWinner: "p1" };
    await wrapper.vm.$nextTick();

    await vi.advanceTimersByTimeAsync(2000); // celebration delay
    await vi.advanceTimersByTimeAsync(5000); // auto-advance delay

    expect(nextRound).toHaveBeenCalledTimes(1);
  });
});
