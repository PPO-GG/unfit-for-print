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

import CompactTopBar from "~/components/game/compact/CompactTopBar.vue";

const player = (userId: string, name: string, extra = {}) =>
  ({ $id: userId, userId, name, avatar: "", playerType: "player", provider: "anonymous", ...extra }) as any;

const base = {
  players: [player("u1", "Mynd"), player("u2", ""), player("u3", "Spec", { playerType: "spectator" })],
  judgeId: "u1",
  lockedIds: ["u2"],
  pillLabel: "R04",
  pillTone: "cyan" as const,
  unread: 0,
};

describe("CompactTopBar", () => {
  it("shows active players only, with judge ring, lock check and a name fallback", () => {
    const w = mount(CompactTopBar, { props: base, global: { stubs: { Icon: true } } });
    const avs = w.findAll("[data-player]");
    expect(avs.map((a) => a.attributes("data-player"))).toEqual(["u1", "u2"]);
    expect(avs[0]!.classes()).toContain("is-judge");
    expect(avs[1]!.find(".ctb-check").exists()).toBe(true);
    expect(avs[1]!.attributes("title")).toBe("compact.player_fallback");
  });

  it("emits menu/chat and badges unread", async () => {
    const w = mount(CompactTopBar, { props: { ...base, unread: 3 }, global: { stubs: { Icon: true } } });
    expect(w.get(".ctb-badge").text()).toBe("3");
    await w.get(".ctb-menu").trigger("click");
    await w.get(".ctb-chat").trigger("click");
    expect(w.emitted("menu")).toHaveLength(1);
    expect(w.emitted("chat")).toHaveLength(1);
  });

  it("hides the badge at zero", () => {
    const w = mount(CompactTopBar, { props: base, global: { stubs: { Icon: true } } });
    expect(w.find(".ctb-badge").exists()).toBe(false);
  });

  it("renders the judge first even when listed last", () => {
    const w = mount(CompactTopBar, {
      props: {
        ...base,
        players: [player("u2", ""), player("u1", "Mynd")],
        judgeId: "u1",
      },
      global: { stubs: { Icon: true } },
    });
    const avs = w.findAll("[data-player]");
    expect(avs[0]!.attributes("data-player")).toBe("u1");
  });

  it("renders 5 avatars and overflow chip for 7 active players", () => {
    const w = mount(CompactTopBar, {
      props: {
        ...base,
        players: [
          player("u1", "Judge"),
          player("u2", "P2"),
          player("u3", "P3"),
          player("u4", "P4"),
          player("u5", "P5"),
          player("u6", "P6"),
          player("u7", "P7"),
        ],
        judgeId: "u1",
        lockedIds: [],
      },
      global: { stubs: { Icon: true } },
    });
    const avs = w.findAll("[data-player]");
    expect(avs).toHaveLength(5); // 5 avatars
    const overflow = w.find(".ctb-av--more");
    expect(overflow.exists()).toBe(true);
    expect(overflow.text()).toBe("+2");
  });
});
