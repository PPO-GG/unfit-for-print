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

vi.mock("~/utils/confetti", () => ({
  burstConfetti: vi.fn(),
  resetConfetti: vi.fn(),
}));
vi.mock("gsap", () => ({ gsap: { to: vi.fn(), set: vi.fn(), fromTo: vi.fn() } }));

// Controllable so both the desktop and the compact tree can be exercised.
// The factory only reads it lazily, when useCompactLayout() runs during mount.
const compactFlag = ref(false);
vi.mock("~/composables/useCompactLayout", () => ({
  useCompactLayout: () => ({
    isCompact: compactFlag,
    orientation: ref("portrait"),
    width: ref(375),
    height: ref(812),
  }),
}));

// GameBoard.vue calls useI18n()/useSfx() as bare Nuxt auto-imports (no
// explicit import statements), so they must exist as globals under plain
// vitest (no Nuxt auto-import plugin configured for tests).
(globalThis as any).useI18n = () => ({ t: (key: string) => key });
const playSfx = vi.fn();
(globalThis as any).useSfx = () => ({ playSfx });

const leaveLobbyMock = vi.fn();
const nextRound = vi.fn(() => ({ success: true }));
const skipBlackCard = vi.fn(() => ({ success: true }));
const engineMock = {
  skipBlackCard,
  selectWinner: vi.fn(),
  nextRound,
  revealCard: vi.fn(),
  playCard: vi.fn(),
  setReadAloud: vi.fn(),
  convertToPlayer: vi.fn(),
  drawCards: vi.fn(),
};

// Minimal controllable Y.Doc-backed game state stand-in.
type TestGameState = {
  phase: string;
  roundWinner: string | null;
  round: number;
  blackCard?: { id: string; text: string; pick: number } | null;
  blackSkipUsed?: boolean;
};
const gameState = ref<TestGameState>({
  phase: "judging",
  roundWinner: null,
  round: 1,
});

// Controllable so the judge-only skip control can be exercised.
const isJudgeRef = ref(false);
const isHostRef = ref(true);

vi.mock("~/composables/useLobby", () => ({
  useLobby: () => ({
    leaveLobby: leaveLobbyMock,
    engine: engineMock,
    reactive: {
      gameState,
      isSubmitting: computed(() => gameState.value.phase === "submitting"),
      isJudging: computed(() => gameState.value.phase === "judging"),
      isRoundEnd: computed(() => gameState.value.phase === "roundEnd"),
      isComplete: computed(() => gameState.value.phase === "complete"),
      isJudge: computed(() => isJudgeRef.value),
      isHost: computed(() => isHostRef.value),
      myHand: computed(() => []),
      mySubmission: computed(() => null),
      leaderboard: computed(() => []),
      cardTexts: computed(() => ({})),
      settings: computed(() => ({})),
      chat: computed(() => []),
    },
  }),
}));

const removePlayerMock = vi.fn(async () => true);
vi.mock("~/composables/useRemovePlayer", () => ({
  useRemovePlayer: () => ({ removePlayer: removePlayerMock }),
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
  // Records how the menu was opened and re-emits what the real menu emits.
  GameEscMenu: {
    props: ["open", "sheet", "playerActions"],
    template:
      "<div class=\"esc-stub\" :data-open=\"String(open)\" :data-sheet=\"String(!!sheet)\" :data-actions=\"JSON.stringify(playerActions ?? [])\"><button class=\"esc-close\" @click=\"$emit('close')\" /><button class=\"esc-leave\" @click=\"$emit('leave')\" /><button class=\"esc-chat\" @click=\"$emit('toggle-chat')\" /><button class=\"esc-convert-other\" @click=\"$emit('convert-spectator', 'someone-else')\" /><button class=\"esc-remove\" @click=\"$emit('remove-player', 'u2')\" /></div>",
  },
  CompactChatSheet: {
    props: ["open"],
    template:
      "<div class=\"chat-stub\" :data-open=\"String(open)\"><button class=\"chat-close\" @click=\"$emit('update:open', false)\" /></div>",
  },
  CompactGameLayout: {
    template: "<div class=\"cgl-stub\"><button class=\"next\" @click=\"$emit('next-round')\" /><button class=\"menu\" @click=\"$emit('open-menu')\" /><button class=\"chat\" @click=\"$emit('open-chat')\" /><button class=\"dealin\" @click=\"$emit('deal-in')\" /></div>",
  },
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
    isJudgeRef.value = false;
    compactFlag.value = false;
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

// The judge's skip control used to live in GameTable's bottom banner, where it
// was both easy to miss and — because that banner is a `pointer-events: none`
// overlay — impossible to click. It now sits under the prompt card in
// GameBoard. These pin the two things that move can quietly break: whether it
// renders at all, and whether the click still goes through GameTable so the
// submitted cards fly home before the engine unmounts them.
describe("GameBoard.vue — skip-prompt control", () => {
  let wrapper: ReturnType<typeof mount> | null = null;
  const tableSkipPrompt = vi.fn();

  const stubs = {
    ...GLOBAL_STUBS,
    GameTable: {
      template: "<div />",
      setup(_: unknown, { expose }: { expose: (e: unknown) => void }) {
        expose({ skipPrompt: tableSkipPrompt });
        return {};
      },
    },
    UButton: {
      props: ["disabled"],
      // Must be declared: without it Vue also binds the parent's @click as a
      // fallthrough attribute on the root <button>, firing the handler twice.
      emits: ["click"],
      template: `<button class="ubtn" :disabled="disabled" @click="$emit('click')"><slot /></button>`,
    },
  };

  const mountBoard = () =>
    mount(GameBoard, {
      props: { lobby: { $id: "lobby1", code: "ABCD" } as any, players: [] },
      global: { stubs },
    });

  beforeEach(() => {
    setActivePinia(createPinia());
    (useUserStore() as any).user = { $id: "judge-1" };
    vi.clearAllMocks();
    vi.useFakeTimers();
    isJudgeRef.value = true;
    compactFlag.value = false;
    gameState.value = {
      phase: "submitting",
      roundWinner: null,
      round: 1,
      blackCard: { id: "b-1", text: "A prompt", pick: 1 },
      blackSkipUsed: false,
    };
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.useRealTimers();
  });

  it("shows the skip button beside the prompt while the judge is waiting", () => {
    wrapper = mountBoard();
    expect(wrapper.find(".deck-skip-btn").exists()).toBe(true);
  });

  it("hides it from everyone but the judge", () => {
    isJudgeRef.value = false;
    wrapper = mountBoard();
    expect(wrapper.find(".deck-skip-btn").exists()).toBe(false);
  });

  it("hides it once the round has moved past submitting", () => {
    gameState.value = { ...gameState.value, phase: "judging" };
    wrapper = mountBoard();
    expect(wrapper.find(".deck-skip-btn").exists()).toBe(false);
  });

  it("routes the click through GameTable so the pile flies home first", async () => {
    wrapper = mountBoard();
    await wrapper.find(".deck-skip-btn").trigger("click");

    expect(tableSkipPrompt).toHaveBeenCalledTimes(1);
    // GameTable emits skip-prompt back after animating; calling the engine
    // straight from here would clear `submissions` and unmount the cards
    // before their positions could be measured.
    expect(skipBlackCard).not.toHaveBeenCalled();
  });

  it("disables itself and says so once the skip is spent", () => {
    gameState.value = { ...gameState.value, blackSkipUsed: true };
    wrapper = mountBoard();

    const btn = wrapper.find(".deck-skip-btn");
    expect(btn.attributes("disabled")).toBeDefined();
    expect(btn.text()).toBe("game.skip_prompt_used");
  });
});

describe("GameBoard.vue — compact layout", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    (useUserStore() as any).user = { id: "host-1", $id: "host-1" };
    vi.clearAllMocks();
    compactFlag.value = false;
    isHostRef.value = true;
  });

  const mountCompact = (players: any[] = []) =>
    mount(GameBoard, {
      props: { lobby: { id: "l1", code: "ABC" } as any, players },
      global: { stubs: GLOBAL_STUBS },
    });

  it("advances on next-round only as host, and opens the game menu as a sheet", async () => {
    compactFlag.value = true;
    gameState.value = { phase: "roundEnd", roundWinner: null, round: 1 };
    const w = mountCompact();
    await w.get(".cgl-stub .next").trigger("click");
    expect(nextRound).toHaveBeenCalledTimes(1);
    expect(w.get(".esc-stub").attributes("data-open")).toBe("false");
    await w.get(".cgl-stub .menu").trigger("click");
    expect(w.get(".esc-stub").attributes("data-open")).toBe("true");
    expect(w.get(".esc-stub").attributes("data-sheet")).toBe("true");
    w.unmount();
  });

  it("uses the centred menu, not the sheet, on desktop", () => {
    gameState.value = { phase: "submitting", roundWinner: null, round: 1 };
    const w = mountCompact();
    expect(w.get(".esc-stub").attributes("data-sheet")).toBe("false");
    expect(w.find(".chat-stub").exists()).toBe(false);
    w.unmount();
  });

  it("lets a spectator deal themselves in, but only the host deals in others", async () => {
    compactFlag.value = true;
    isHostRef.value = false;
    (useUserStore() as any).user = { id: "spec-1", $id: "spec-1" };
    engineMock.convertToPlayer.mockReturnValue({ success: true });
    gameState.value = { phase: "submitting", roundWinner: null, round: 1 };
    const w = mountCompact();
    await w.get(".cgl-stub .dealin").trigger("click");
    expect(engineMock.convertToPlayer).toHaveBeenCalledWith("spec-1");
    await w.get(".esc-convert-other").trigger("click");
    expect(engineMock.convertToPlayer).toHaveBeenCalledTimes(1);
    w.unmount();
  });

  it("does not advance on next-round for a non-host", async () => {
    compactFlag.value = true;
    isHostRef.value = false;
    gameState.value = { phase: "roundEnd", roundWinner: null, round: 1 };
    const w = mountCompact();
    await w.get(".cgl-stub .next").trigger("click");
    expect(nextRound).not.toHaveBeenCalled();
    w.unmount();
  });

  it("open-chat opens the chat sheet, not the menu", async () => {
    compactFlag.value = true;
    gameState.value = { phase: "submitting", roundWinner: null, round: 1 };
    const w = mountCompact();
    await w.get(".cgl-stub .chat").trigger("click");
    expect(w.get(".chat-stub").attributes("data-open")).toBe("true");
    expect(w.get(".esc-stub").attributes("data-open")).toBe("false");
    await w.get(".chat-close").trigger("click");
    expect(w.get(".chat-stub").attributes("data-open")).toBe("false");
    w.unmount();
  });

  it("the menu's Chat item swaps the menu for the chat sheet", async () => {
    compactFlag.value = true;
    gameState.value = { phase: "submitting", roundWinner: null, round: 1 };
    const w = mountCompact();
    await w.get(".cgl-stub .menu").trigger("click");
    await w.get(".esc-chat").trigger("click");
    expect(w.get(".esc-stub").attributes("data-open")).toBe("false");
    expect(w.get(".chat-stub").attributes("data-open")).toBe("true");
    w.unmount();
  });

  it("Escape toggles the menu sheet, and leaves it alone while chat is open", async () => {
    compactFlag.value = true;
    gameState.value = { phase: "submitting", roundWinner: null, round: 1 };
    const w = mountCompact();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await w.vm.$nextTick();
    expect(w.get(".esc-stub").attributes("data-open")).toBe("true");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await w.vm.$nextTick();
    expect(w.get(".esc-stub").attributes("data-open")).toBe("false");

    await w.get(".cgl-stub .chat").trigger("click");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await w.vm.$nextTick();
    expect(w.get(".esc-stub").attributes("data-open")).toBe("false");
    w.unmount();
  });

  // A dialog on top (confirm, report, settings) closes itself on the same
  // ESC; toggling the menu too opened it behind the dialog being dismissed.
  it.each([true, false])("Escape leaves the menu alone while another dialog is open (compact=%s)", async (compact) => {
    compactFlag.value = compact;
    gameState.value = { phase: "submitting", roundWinner: null, round: 1 };
    const w = mountCompact();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    document.body.appendChild(dialog);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await w.vm.$nextTick();
    expect(w.get(".esc-stub").attributes("data-open")).toBe("false");

    dialog.setAttribute("data-state", "closed");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await w.vm.$nextTick();
    expect(w.get(".esc-stub").attributes("data-open")).toBe("true");
    dialog.remove();
    w.unmount();
  });

  // A backgrounded phone can resync from round N's end straight into round
  // N+1's. With the same winner both times the winner never "changes", so the
  // celebration (winnerSelected) must still come back for the new round.
  it("celebrates again after resyncing into the next round with the same winner", async () => {
    vi.useFakeTimers();
    try {
      compactFlag.value = true;
      gameState.value = { phase: "judging", roundWinner: null, round: 1 };
      const w = mountCompact();
      gameState.value = { phase: "roundEnd", roundWinner: "a", round: 1 };
      await w.vm.$nextTick();
      vi.advanceTimersByTime(2000);
      await w.vm.$nextTick();
      expect(w.get(".cgl-stub").attributes("winner-selected")).toBe("true");

      gameState.value = { phase: "roundEnd", roundWinner: "a", round: 2 };
      await w.vm.$nextTick();
      expect(w.get(".cgl-stub").attributes("winner-selected")).toBe("false");
      expect(w.get(".cgl-stub").attributes("confirmed-round-winner")).toBe("a");
      vi.advanceTimersByTime(2000);
      await w.vm.$nextTick();
      expect(w.get(".cgl-stub").attributes("winner-selected")).toBe("true");
      w.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("Leave from the menu emits leave once and does not run its own leave flow", async () => {
    compactFlag.value = true;
    gameState.value = { phase: "submitting", roundWinner: null, round: 1 };
    const w = mountCompact();
    await w.get(".esc-leave").trigger("click");
    expect(w.emitted("leave")).toHaveLength(1);
    expect(leaveLobbyMock).not.toHaveBeenCalled();
    w.unmount();
  });

  // The old sidebar gave the host per-player controls; the menu keeps them.
  it("gives the host skip / deal-in / remove for each other player", () => {
    compactFlag.value = true;
    gameState.value = {
      phase: "submitting",
      roundWinner: null,
      round: 1,
      judgeId: "host-1",
      submissions: { u4: ["c1"] },
      skippedPlayers: ["u5"],
    } as any;
    const w = mountCompact([
      { $id: "host-1", userId: "host-1", name: "Me", playerType: "player" },
      { $id: "u2", userId: "u2", name: "Sam", playerType: "player" },
      { $id: "u3", userId: "u3", name: "Ed", playerType: "spectator" },
      { $id: "u4", userId: "u4", name: "Done", playerType: "player" },
      { $id: "u5", userId: "u5", name: "Skipped", playerType: "bot" },
    ]);
    expect(JSON.parse(w.get(".esc-stub").attributes("data-actions")!)).toEqual([
      { id: "u2", name: "Sam", actions: ["skip", "remove"] },
      { id: "u3", name: "Ed", actions: ["deal-in", "remove"] },
      { id: "u4", name: "Done", actions: ["remove"] },
      { id: "u5", name: "Skipped", actions: ["remove"] },
    ]);
    w.unmount();
  });

  it("gives a non-host no player actions", () => {
    compactFlag.value = true;
    isHostRef.value = false;
    gameState.value = { phase: "submitting", roundWinner: null, round: 1 } as any;
    const w = mountCompact([{ $id: "u2", userId: "u2", name: "Sam", playerType: "player" }]);
    expect(JSON.parse(w.get(".esc-stub").attributes("data-actions")!)).toEqual([]);
    w.unmount();
  });

  it("removes a player through the shared confirm-and-kick flow", async () => {
    compactFlag.value = true;
    gameState.value = { phase: "submitting", roundWinner: null, round: 1 } as any;
    const sam = { $id: "u2", userId: "u2", name: "Sam", playerType: "player" };
    const w = mountCompact([sam]);
    await w.get(".esc-remove").trigger("click");
    expect(removePlayerMock).toHaveBeenCalledWith("l1", sam);
    w.unmount();
  });
});
