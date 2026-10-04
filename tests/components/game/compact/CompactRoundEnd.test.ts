import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
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

import CompactRoundEnd from "~/components/game/compact/CompactRoundEnd.vue";

const p = (userId: string, name: string, playerType = "player") =>
  ({ $id: userId, userId, name, avatar: "", playerType, provider: "anonymous" }) as any;
const players = [p("u1", "Mynd"), p("u2", "Grover"), p("u3", ""), p("u4", "Spec", "spectator")];

describe("CompactRoundEnd", () => {
  it("shows the winner, sorts the race, excludes spectators, falls back on empty names", () => {
    const w = mount(CompactRoundEnd, {
      props: { winnerId: "u2", players, scores: { u1: 5, u2: 3, u3: 1 }, goal: 10, round: 4, skipped: false },
    });
    expect(w.get(".cre-kicker").text()).toBe('compact.round_won|{"round":4}');
    expect(w.get(".cre-winner").text()).toBe('compact.winner_plus|{"name":"Grover"}');
    const names = w.findAll(".cre-name").map((n) => n.text());
    expect(names).toEqual(["Mynd", "Grover", "compact.player_fallback"]);
    expect(w.get(".cre-row.is-winner .cre-plus").text()).toBe("+1");
    expect(w.findAll(".cre-bar i")[0]!.attributes("style")).toContain("width: 50%");
  });

  it("skipped variant: prompt-skipped kicker, no winner line, no +1", () => {
    const w = mount(CompactRoundEnd, {
      props: { winnerId: null, players, scores: {}, goal: 10, round: 4, skipped: true },
    });
    expect(w.get(".cre-kicker").text()).toBe("game.prompt_skipped");
    expect(w.find(".cre-winner").exists()).toBe(false);
    expect(w.find(".cre-plus").exists()).toBe(false);
  });
});
