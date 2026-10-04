import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import * as Vue from "vue";

// Nuxt auto-imports Vue APIs; plain vitest needs them on globalThis.
Object.assign(globalThis, Vue);
// i18n stub: returns "key" or "key|{json params}" so assertions can see params.
(globalThis as any).useI18n = () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}|${JSON.stringify(params)}` : key,
});
(globalThis as any).useSfx = () => ({ playSfx: vi.fn() });
vi.mock("gsap", () => ({
  gsap: { to: vi.fn(), set: vi.fn(), fromTo: vi.fn(), killTweensOf: vi.fn(),
          timeline: vi.fn(() => ({ to: vi.fn().mockReturnThis(), fromTo: vi.fn().mockReturnThis() })) },
}));
vi.unmock("vue");

vi.mock("~/composables/useCompactLayout", () => ({
  useCompactLayout: () => ({
    isCompact: Vue.ref(true), orientation: Vue.ref("portrait"),
    width: Vue.ref(375), height: Vue.ref(812),
  }),
}));
const motion = {
  reduced: () => false, dealIn: vi.fn(), popSelect: vi.fn(), bounce: vi.fn(),
  crown: vi.fn(), dropIn: vi.fn(), fillBars: vi.fn(),
  flyToPrompt: vi.fn((_t: unknown, _target: unknown, done?: () => void) => done?.()),
};
vi.mock("~/composables/useCompactMotion", () => ({ useCompactMotion: () => motion }));
vi.mock("~/utils/readAloud", () => ({
  buildReadAloudText: vi.fn(async () => "merged joke"),
  resolveWhiteTextsViaApi: vi.fn(),
}));
vi.mock("~/utils/confetti", () => ({ burstConfetti: vi.fn() }));

import CompactGameLayout from "~/components/game/compact/CompactGameLayout.vue";

const pl = (userId: string, name: string, playerType = "player") =>
  ({ $id: userId, userId, name, avatar: "", playerType, provider: "anonymous" }) as any;

const stubs = {
  CompactTopBar: { props: ["pillLabel"], template: "<div class=\"topbar\" @click=\"$emit('menu')\">{{ pillLabel }}</div>" },
  BlackCard: { props: ["fills", "scale"], template: '<div class="black" :data-fills="JSON.stringify(fills)" />' },
  CompactCardCarousel: {
    props: ["mode", "cards", "interactive", "order"],
    template:
      "<div class=\"carousel\" :data-mode=\"mode\" :data-interactive=\"String(interactive)\">" +
      "<button class=\"c-select\" @click=\"$emit('select', cards[0])\" />" +
      "<button class=\"c-reveal\" @click=\"$emit('reveal', 'p2')\" />" +
      "<button class=\"c-pick\" @click=\"$emit('pick', 'p2')\" />" +
      "<button class=\"c-read\" @click=\"$emit('read-aloud', 'p2')\" /></div>",
  },
  CompactActionBar: {
    props: ["state"],
    template: "<button class=\"act\" :data-label=\"state.labelKey\" @click=\"state.action && $emit('act', state.action)\">{{ JSON.stringify(state.params ?? null) }}</button>",
  },
  CompactRoundEnd: { props: ["skipped", "winnerId"], template: '<div class="round-end" :data-skipped="String(skipped)" />' },
  PromptSkippedOverlay: true,
  UButton: { emits: ["click"], template: "<button class=\"ubtn\" @click=\"$emit('click')\"><slot /></button>" },
  Icon: true,
};

const base = {
  phase: "submitting",
  blackCard: { id: "b1", text: "What ruined Friday night? _.", pick: 1 },
  myHand: ["w1", "w2"],
  mySubmission: null,
  submissions: {},
  revealedCards: {},
  scores: {},
  goal: 10,
  round: 4,
  myId: "u2",
  isJudge: false,
  isHost: false,
  isSpectator: false,
  players: [pl("u1", "Mynd"), pl("u2", "Grover"), pl("u3", "Leo")],
  judgeId: "u1",
  cardTexts: { w1: { text: "Brunch", pack: "core" } },
  effectiveRoundWinner: null,
  confirmedRoundWinner: null,
  winnerSelected: false,
  winningCards: [],
  readingAloud: false,
  promptSerial: 1,
  blackSkipUsed: false,
  needsManualDraw: false,
  drawCount: 0,
  chatUnread: 0,
};
const mk = (over: Record<string, unknown> = {}) =>
  mount(CompactGameLayout, { props: { ...base, ...over } as any, global: { stubs } });

describe("CompactGameLayout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("player picks, prompt fills live, submit emits after the fly-in", async () => {
    const w = mk();
    expect(w.get(".carousel").attributes("data-mode")).toBe("select");
    expect(w.get(".act").attributes("data-label")).toBe("compact.select_more");
    await w.get(".c-select").trigger("click");
    expect(w.get(".black").attributes("data-fills")).toBe('["Brunch"]');
    expect(w.get(".act").attributes("data-label")).toBe("compact.submit");
    await w.get(".act").trigger("click");
    vi.advanceTimersByTime(700);
    expect(w.emitted("select-cards")).toEqual([[["w1"]]]);
  });

  it("judge waits with a skip-prompt control", async () => {
    const w = mk({ isJudge: true, myId: "u1" });
    expect(w.find(".carousel").exists()).toBe(false);
    await w.get(".ubtn").trigger("click");
    expect(w.emitted("skip-prompt")).toHaveLength(1);
  });

  it("spectators get a banner instead of a hand", () => {
    const w = mk({ isSpectator: true, myHand: [] });
    expect(w.find(".carousel").exists()).toBe(false);
    expect(w.text()).toContain("compact.spectating");
  });

  it("submitting-complete shows the shuffle card, never a blank", () => {
    const w = mk({ phase: "submitting-complete" });
    expect(w.text()).toContain("compact.all_in");
  });

  it("judge reveals, picks, and crowns", async () => {
    const w = mk({
      phase: "judging", isJudge: true, myId: "u1",
      submissions: { p2: ["w2"], p3: ["w3"] }, revealedCards: { p3: true },
    });
    expect(w.get(".carousel").attributes("data-mode")).toBe("judge");
    await w.get(".c-reveal").trigger("click");
    expect(w.emitted("reveal-card")).toEqual([["p2"]]);
    await w.setProps({ revealedCards: { p2: true, p3: true } });
    await w.get(".c-pick").trigger("click");
    expect(w.get(".act").attributes("data-label")).toBe("compact.crown");
    await w.get(".act").trigger("click");
    expect(w.emitted("select-winner")).toEqual([["p2"]]);
  });

  it("watchers see a read-only carousel and the judge's name (with fallback)", () => {
    const w = mk({
      phase: "judging", players: [pl("u1", ""), pl("u2", "Grover")],
      submissions: { u2: ["w1"] }, revealedCards: {},
    });
    expect(w.get(".carousel").attributes("data-interactive")).toBe("false");
    expect(w.get(".act").attributes("data-label")).toBe("compact.waiting_for_judge");
    expect(w.get(".act").text()).toContain("compact.player_fallback");
  });

  it("read-aloud builds the merged text and emits it", async () => {
    vi.useRealTimers();
    const w = mk({
      phase: "judging", isJudge: true, myId: "u1",
      submissions: { p2: ["w2"] }, revealedCards: { p2: true },
    });
    await w.get(".c-read").trigger("click");
    await flushPromises();
    expect(w.emitted("read-aloud")).toEqual([["merged joke"]]);
  });

  it("skipped round: round-end screen right away; only the host can advance", async () => {
    const host = mk({ phase: "roundEnd", isHost: true });
    expect(host.get(".round-end").attributes("data-skipped")).toBe("true");
    await host.get(".act").trigger("click");
    expect(host.emitted("next-round")).toHaveLength(1);

    const guest = mk({ phase: "roundEnd" });
    expect(guest.get(".act").attributes("data-label")).toBe("compact.next_round_soon");
  });

  it("winner chosen but celebration not started: keeps the judging view, no early advance", () => {
    const w = mk({
      phase: "roundEnd", isHost: true, effectiveRoundWinner: "p2",
      submissions: { p2: ["w2"] }, revealedCards: { p2: true }, winnerSelected: false,
    });
    expect(w.find(".round-end").exists()).toBe(false);
    expect(w.get(".act").attributes("data-label")).toBe("compact.next_round_soon");
  });

  it("manual draw shows a draw button", async () => {
    const w = mk({ needsManualDraw: true, drawCount: 3, myHand: [] });
    const draw = w.get(".cgl-draw");
    expect(draw.text()).toContain("compact.draw");
    await draw.trigger("click");
    expect(w.emitted("draw")).toHaveLength(1);
  });

  it("menu button opens the menu", async () => {
    const w = mk();
    await w.get(".topbar").trigger("click");
    expect(w.emitted("open-menu")).toHaveLength(1);
  });
});
