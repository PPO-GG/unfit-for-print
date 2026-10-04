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
vi.mock("~/utils/confetti", () => ({ burstConfetti: vi.fn() }));
vi.mock("gsap", () => {
  const tl = { fromTo: vi.fn().mockReturnThis(), to: vi.fn().mockReturnThis(), call: vi.fn().mockReturnThis(), kill: vi.fn() };
  return { gsap: { timeline: vi.fn(() => tl), fromTo: vi.fn(), set: vi.fn() } };
});
vi.mock("~/composables/useCompactLayout", () => ({
  useCompactLayout: () => ({ isCompact: Vue.ref(true), orientation: Vue.ref("portrait"), width: Vue.ref(375), height: Vue.ref(812) }),
}));
vi.unmock("vue");

import GameOver from "~/components/game/GameOver.vue";
import { useUserStore } from "~/stores/userStore";

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
    expect(rest[0]!.text()).toContain("4 · Leo");
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
});
