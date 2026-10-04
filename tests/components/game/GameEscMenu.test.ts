import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import * as Vue from "vue";

Object.assign(globalThis, Vue);
(globalThis as any).useI18n = () => ({
  t: (key: string, fallbackOrParams?: unknown) =>
    typeof fallbackOrParams === "object" && fallbackOrParams
      ? `${key}|${JSON.stringify(fallbackOrParams)}`
      : key,
});
vi.unmock("vue");

vi.mock("~/stores/userPrefsStore", () => ({ useUserPrefsStore: () => ({}) }));
vi.mock("~/composables/useMusicPlayer", () => ({
  useMusicPlayer: () => ({ isPlaying: { value: false }, toggle: vi.fn() }),
}));
vi.mock("~/composables/useReportProblem", () => ({
  useReportProblem: () => ({ open: vi.fn() }),
}));

import GameEscMenu from "~/components/game/GameEscMenu.vue";

const stubs = { teleport: true, UIcon: true, USwitch: true, UButton: true };
const mk = (props: Record<string, unknown> = {}) =>
  mount(GameEscMenu, { props: { open: true, lobbyCode: "ABCD", ...props }, global: { stubs } });

describe("GameEscMenu", () => {
  it("renders as a centred dialog by default", () => {
    const w = mk();
    expect(w.find(".esc-menu-panel--sheet").exists()).toBe(false);
    expect(w.find(".esc-menu-hint").exists()).toBe(true);
  });

  // Phones get the same menu, slid up from the bottom; there is no ESC key or
  // T shortcut to advertise there.
  it("renders as a bottom sheet with a grabber and no keyboard hints", () => {
    const w = mk({ sheet: true });
    expect(w.find(".esc-menu-backdrop--sheet").exists()).toBe(true);
    expect(w.find(".esc-menu-panel--sheet").exists()).toBe(true);
    expect(w.find(".esc-menu-grabber").exists()).toBe(true);
    expect(w.find(".esc-menu-hint").exists()).toBe(false);
    expect(w.find(".esc-menu-kbd").exists()).toBe(false);
  });

  it("closes when the backdrop is tapped", async () => {
    const w = mk({ sheet: true });
    await w.get(".esc-menu-backdrop").trigger("click");
    expect(w.emitted("close")).toHaveLength(1);
  });

  describe("host tools player actions", () => {
    const playerActions = [
      { id: "u2", name: "Sam", actions: ["skip", "remove"] },
      { id: "u3", name: "Ed", actions: ["deal-in", "remove"] },
    ];
    const openHostTools = async (props: Record<string, unknown> = {}) => {
      const w = mk({ isHost: true, playerActions, ...props });
      const hostBtn = w
        .findAll(".esc-menu-item")
        .find((b) => b.text().includes("game.host_tools"));
      await hostBtn!.trigger("click");
      return w;
    };

    it("lists each player with the actions the host can take", async () => {
      const w = await openHostTools();
      const rows = w.findAll(".esc-menu-player");
      expect(rows.map((r) => r.get(".esc-menu-player-name").text())).toEqual(["Sam", "Ed"]);
      expect(rows[0]!.find(".esc-menu-player-skip").exists()).toBe(true);
      expect(rows[0]!.find(".esc-menu-player-dealin").exists()).toBe(false);
      expect(rows[1]!.find(".esc-menu-player-dealin").exists()).toBe(true);
    });

    it("emits skip-player, convert-spectator and remove-player with the player id", async () => {
      const w = await openHostTools();
      const rows = w.findAll(".esc-menu-player");
      await rows[0]!.get(".esc-menu-player-skip").trigger("click");
      await rows[1]!.get(".esc-menu-player-dealin").trigger("click");
      await rows[1]!.get(".esc-menu-player-remove").trigger("click");
      expect(w.emitted("skip-player")).toEqual([["u2"]]);
      expect(w.emitted("convert-spectator")).toEqual([["u3"]]);
      expect(w.emitted("remove-player")).toEqual([["u3"]]);
    });

    it("hides the player section when there is nobody to act on", async () => {
      const w = await openHostTools({ playerActions: [] });
      expect(w.find(".esc-menu-players").exists()).toBe(false);
    });
  });
});
