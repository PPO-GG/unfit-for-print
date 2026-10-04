import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import * as Vue from "vue";

Object.assign(globalThis, Vue);
(globalThis as any).useI18n = () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}|${JSON.stringify(params)}` : key,
});
const markPlayerReturnedToLobby = vi.fn(async () => {});
vi.mock("~/composables/useLobby", () => ({ useLobby: () => ({ markPlayerReturnedToLobby }) }));
vi.mock("~/composables/useNotifications", () => ({ useNotifications: () => ({ notify: vi.fn() }) }));
vi.mock("~/composables/useSfx", () => ({ useSfx: () => ({ playSfx: vi.fn() }) }));
const motion = vi.hoisted(() => ({ value: "no-preference" }));
vi.mock("@vueuse/core", async (orig) => ({
  ...(await orig<typeof import("@vueuse/core")>()),
  usePreferredReducedMotion: () => motion,
}));
vi.mock("~/utils/confetti", () => ({ burstConfetti: vi.fn(), resetConfetti: vi.fn() }));
const tl = vi.hoisted(() => ({
  fromTo: vi.fn().mockReturnThis(),
  to: vi.fn().mockReturnThis(),
  call: vi.fn().mockReturnThis(),
  kill: vi.fn(),
}));
vi.mock("gsap", () => ({ gsap: { timeline: vi.fn(() => tl), fromTo: vi.fn(() => tl), set: vi.fn() } }));
vi.mock("~/composables/useCompactLayout", () => ({
  useCompactLayout: () => ({ isCompact: Vue.ref(true), orientation: Vue.ref("portrait"), width: Vue.ref(375), height: Vue.ref(812) }),
}));
vi.unmock("vue");

import GameOver from "~/components/game/GameOver.vue";
import { useUserStore } from "~/stores/userStore";
import { gsap } from "gsap";
import { resetConfetti } from "~/utils/confetti";

const pl = (userId: string, name: string) =>
  ({ $id: `row-${userId}`, userId, name, lobbyId: "lobby-1", avatar: "", playerType: "player" }) as any;
const players = [pl("a", "Mynd"), pl("b", "Maxwell"), pl("c", "Grover"), pl("d", "Leo")];
const leaderboard = [
  { playerId: "a", points: 10 },
  { playerId: "b", points: 6 },
  { playerId: "c", points: 3 },
  { playerId: "d", points: 1 },
];
const stubs = { AvatarDecoration: { template: "<div><slot /></div>" } };
const mk = (over = {}) =>
  mount(GameOver, { props: { leaderboard, players, round: 15, goal: 10, ...over }, global: { stubs } });

describe("GameOver (podium)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useUserStore().user = { id: "d" } as any;
    // Leave setImmediate real: flushPromises schedules through it.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
    markPlayerReturnedToLobby.mockClear();
    motion.value = "no-preference";
    vi.mocked(gsap.timeline).mockClear();
    vi.mocked(gsap.fromTo).mockClear();
    tl.kill.mockClear();
    vi.mocked(resetConfetti).mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("headline names the winner; subtitle has round and goal", () => {
    const w = mk();
    expect(w.get(".go-title").attributes("aria-label")).toBe('gameover.wins|{"name":"Mynd"}');
    expect(w.get(".go-kicker").text()).toContain('gameover.subtitle|{"round":15,"goal":10}');
  });

  it("wraps the headline by word, never splitting a word's characters across wrappers", () => {
    const w = mk({ leaderboard: [{ playerId: "b", points: 7 }, { playerId: "a", points: 7 }] });
    const label = w.get(".go-title").attributes("aria-label")!;
    const words = w.findAll(".go-title .go-word");
    expect(words).toHaveLength(label.split(" ").length);
    expect(words.length).toBeGreaterThan(1);
    expect(words.map((x) => x.findAll(".go-char").map((c) => c.text()).join(""))).toEqual(label.split(" "));
    for (const c of w.findAll(".go-char")) expect(c.text()).not.toMatch(/\s/);
  });

  it("flags a very long one-word name and exposes the longest word length for fitting", () => {
    const longName = "A".repeat(32);
    const w = mk({ players: [pl("a", longName), ...players.slice(1)] });
    const long = w.findAll(".go-word--long");
    expect(long).toHaveLength(1);
    expect(long[0]!.text()).toContain(longName);
    // The i18n stub glues the key and params into one unbroken word, so the longest
    // word is the whole label; the property must equal its length.
    const label = w.get(".go-title").attributes("aria-label")!;
    const longest = Math.max(...label.split(" ").map((x) => x.length));
    expect(longest).toBeGreaterThan(32);
    expect(w.get(".go-title").attributes("style")).toContain(`--go-longest: ${longest}`);
  });

  it("keeps an emoji as one character", () => {
    const w = mk({ players: [pl("a", "Mynd 👍🏽"), ...players.slice(1)] });
    expect(w.findAll(".go-char").map((c) => c.text())).toContain("👍🏽");
  });

  it("lays the podium out 2-1-3 and lists the rest with my row highlighted", () => {
    const w = mk();
    expect(w.findAll(".go-step").map((s) => s.attributes("data-place"))).toEqual(["2", "1", "3"]);
    const rest = w.findAll(".go-row");
    expect(rest).toHaveLength(1);
    expect(rest[0]!.classes()).toContain("is-me");
    expect(rest[0]!.text()).toContain("4 · gameover.you (Leo)");
  });

  it("names joint winners together", () => {
    const w = mk({ leaderboard: [{ playerId: "a", points: 7 }, { playerId: "b", points: 7 }] });
    expect(w.get(".go-title").attributes("aria-label")).toBe('gameover.wins|{"name":"Maxwell & Mynd"}');
  });

  it("continue marks me returned and emits", async () => {
    const w = mk();
    await w.get(".go-continue").trigger("click");
    await flushPromises();
    expect(markPlayerReturnedToLobby).toHaveBeenCalledWith("lobby-1", "d");
    expect(w.emitted("continue")).toHaveLength(1);
  });

  it("auto-returns after 60 seconds", async () => {
    const w = mk();
    vi.advanceTimersByTime(60_000);
    await flushPromises();
    expect(markPlayerReturnedToLobby).toHaveBeenCalledTimes(1);
    expect(w.emitted("continue")).toHaveLength(1);
  });

  it("caps a crowded step at three people, shows +N, and lists the overflow as rows", () => {
    const crowd = ["e", "f", "g", "h", "i", "j"].map((id, i) => pl(id, `Tied${i + 1}`));
    const w = mk({
      players: [...players, ...crowd],
      leaderboard: [{ playerId: "a", points: 10 }, ...crowd.map((c) => ({ playerId: c.userId, points: 0 }))],
    });
    const second = w.get('.go-step[data-place="2"]');
    expect(second.findAll(".go-person")).toHaveLength(3);
    expect(second.get(".go-more").text()).toBe("+3");
    expect(w.get('.go-step[data-place="1"]').findAll(".go-more")).toHaveLength(0);
    const rows = w.findAll(".go-row");
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.text())).toEqual(["2 · Tied4", "2 · Tied5", "2 · Tied6"].map((x) => expect.stringContaining(x)));
  });

  it("keeps emoji whole in avatar initials", () => {
    const w = mk({ players: [{ ...pl("a", "👍🏽🔥 Mynd"), playerType: "bot" }, ...players.slice(1)] });
    expect(w.get(".go-avatar span").text()).toBe("👍🏽🔥");
  });

  it("falls back to the generic title when there is no leaderboard", () => {
    const w = mk({ leaderboard: [] });
    expect(w.get(".go-title").attributes("aria-label")).toBe("game.game_over");
  });

  it("stops confetti and the timeline on unmount, and never auto-returns afterwards", async () => {
    const w = mk();
    await flushPromises();
    w.unmount();
    expect(tl.kill).toHaveBeenCalled();
    expect(resetConfetti).toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    await flushPromises();
    expect(markPlayerReturnedToLobby).not.toHaveBeenCalled();
  });

  it("under reduced motion only fades the root in (no timeline)", async () => {
    motion.value = "reduce";
    const w = mk();
    await flushPromises();
    expect(gsap.timeline).not.toHaveBeenCalled();
    expect(gsap.fromTo).toHaveBeenCalledTimes(1);
    expect(vi.mocked(gsap.fromTo).mock.calls[0]![0]).toBe(w.element);
  });
});
