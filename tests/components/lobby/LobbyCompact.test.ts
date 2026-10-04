import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import * as Vue from "vue";
import { nextTick } from "vue";

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

const openReport = vi.fn();
vi.mock("~/composables/useReportProblem", () => ({
  useReportProblem: () => ({ open: openReport }),
  default: () => ({ open: openReport }),
}));
vi.mock("~/utils/shareInvite", () => ({ shareInvite: vi.fn(async () => "copied") }));
vi.mock("~/composables/useCompactLayout", () => ({
  useCompactLayout: () => ({ isCompact: Vue.ref(true), orientation: Vue.ref("portrait"), width: Vue.ref(375), height: Vue.ref(812) }),
}));
const inDiscord = Vue.ref(false);
(globalThis as any).useDiscordSDK = () => ({ isDiscordActivity: inDiscord });
(globalThis as any).useRuntimeConfig = () => ({ public: { baseUrl: "https://unfit.cards" } });
const notify = vi.fn();
(globalThis as any).useNotifications = () => ({ notify });

import { shareInvite } from "~/utils/shareInvite";
import LobbyCompact from "~/components/lobby/LobbyCompact.vue";

const p = (userId: string, ready: boolean, playerType = "player") =>
  ({ $id: userId, userId, name: userId, ready, playerType }) as any;
const stubs = {
  LobbyPlayerList: { template: "<div class=\"plist\"><button class=\"kick\" @click=\"$emit('kick', 'b1')\" /></div>" },
  LobbyChat: { template: '<div class="chat" />' },
  LobbySettingsSummary: { template: "<div class=\"summary\" @click=\"$emit('edit')\" />" },
  LobbyRoundPreview: { template: '<div class="preview" />' },
  UDrawer: { props: ["open"], template: '<div v-if="open"><slot name="body" /></div>' },
};
const base = {
  code: "3046EP",
  lobbyName: "Friday Night",
  players: [p("u1", true), p("u2", false), p("b1", false, "bot")],
  myId: "u1",
  isHost: true,
  isStarting: false,
  maxSeats: 8,
  settings: null,
  packNames: {},
  shuffling: false,
  chatMessages: [],
};
// v-show toggles inline display; the wrapper is not attached to the document.
const shown = (w: any, sel: string) => w.get(sel).element.style.display !== "none";
const mk = (over = {}) => mount(LobbyCompact, { props: { ...base, ...over } as any, global: { stubs } });

describe("LobbyCompact", () => {
  it("shows the code as the hero and shares the invite link", async () => {
    const w = mk();
    expect(w.get(".lc-code").text()).toBe("3046EP");
    await w.get(".lc-code-btn").trigger("click");
    expect(shareInvite).toHaveBeenCalledWith(
      "https://unfit.cards/game/3046EP",
      expect.objectContaining({ inDiscord: false }),
    );
  });

  it("switches tabs, keeping every panel mounted and only the active one visible", async () => {
    const w = mk();
    // LobbyChat stays mounted on the Players tab so its draft and scroll survive tab switches.
    expect(w.find(".chat").exists()).toBe(true);
    expect(shown(w, "#lc-panel-players")).toBe(true);
    expect(shown(w, "#lc-panel-chat")).toBe(false);
    expect(shown(w, "#lc-panel-settings")).toBe(false);
    await w.get('[data-tab="chat"]').trigger("click");
    expect(shown(w, "#lc-panel-chat")).toBe(true);
    expect(shown(w, "#lc-panel-players")).toBe(false);
    expect(w.get("#lc-panel-chat").attributes("aria-labelledby")).toBe("lc-tab-chat");
    await w.get('[data-tab="settings"]').trigger("click");
    expect(shown(w, "#lc-panel-settings")).toBe(true);
    expect(shown(w, "#lc-panel-chat")).toBe(false);
    await w.get(".summary").trigger("click");
    expect(w.emitted("edit-settings")).toHaveLength(1);
  });

  describe("on-screen keyboard", () => {
    const original = Object.getOwnPropertyDescriptor(window, "visualViewport");
    let vv: any;
    beforeEach(() => {
      vv = Object.assign(new EventTarget(), { height: window.innerHeight - 300, offsetTop: 0 });
      Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
    });
    afterEach(() => {
      if (original) Object.defineProperty(window, "visualViewport", original);
      else delete (window as any).visualViewport;
    });

    it("only flags the keyboard as open on the Chat tab", async () => {
      const w = mk();
      expect(w.classes()).not.toContain("lc--kb");
      await w.get('[data-tab="chat"]').trigger("click");
      expect(w.classes()).toContain("lc--kb");
      await w.get('[data-tab="players"]').trigger("click");
      expect(w.classes()).not.toContain("lc--kb");
    });

    it("does not flag a small viewport change as a keyboard", async () => {
      vv.height = window.innerHeight - 40;
      const w = mk();
      await w.get('[data-tab="chat"]').trigger("click");
      expect(w.classes()).not.toContain("lc--kb");
    });

    it("sizes to the visual viewport and follows iOS panning", async () => {
      const w = mk();
      vv.offsetTop = 120;
      vv.dispatchEvent(new Event("scroll"));
      await nextTick();
      const style = (w.element as HTMLElement).style;
      expect(style.height).toBe(`${vv.height}px`);
      expect(style.transform).toBe("translateY(120px)");
    });
  });

  it("falls back to the share failure toast", async () => {
    vi.mocked(shareInvite).mockResolvedValueOnce("failed");
    const w = mk();
    await w.get(".lc-code-btn").trigger("click");
    await flushPromises();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ color: "error" }));
  });

  it("tells the share helper when running inside Discord", async () => {
    inDiscord.value = true;
    try {
      const w = mk();
      await w.get(".lc-code-btn").trigger("click");
      expect(shareInvite).toHaveBeenLastCalledWith(
        "https://unfit.cards/game/3046EP",
        expect.objectContaining({ inDiscord: true }),
      );
    } finally {
      inDiscord.value = false;
    }
  });

  it("badges chat messages that arrive while another tab is open", async () => {
    const w = mk();
    await w.setProps({ chatMessages: [{ id: "m1" }, { id: "m2" }] as any });
    expect(w.get('[data-tab="chat"] .lc-badge').text()).toBe("2");
    await w.get('[data-tab="chat"]').trigger("click");
    expect(w.find(".lc-badge").exists()).toBe(false);
  });

  it("host start button explains why it can't start yet", () => {
    const w = mk();
    const start = w.get(".lc-start");
    expect(start.attributes("disabled")).toBeDefined();
    expect(start.text()).toBe('lobby.compact.ready_count|{"ready":2,"total":3}');
  });

  it("host start button reads Starting while the game is starting", () => {
    const w = mk({ isStarting: true, players: [p("u1", true), p("u2", true), p("b1", false, "bot")] });
    expect(w.get(".lc-start").text()).toBe("lobby.compact.starting");
  });

  it("guests see what they are waiting for", async () => {
    const w = mk({ isHost: false, myId: "u2" });
    expect(w.get(".lc-hint").text()).toBe('lobby.compact.ready_count|{"ready":2,"total":3}');
    await w.setProps({ players: [p("u1", true), p("u2", true), p("b1", false, "bot")] });
    expect(w.get(".lc-hint").text()).toBe("lobby.compact.waiting_host");
    expect(mk().find(".lc-hint").exists()).toBe(false);
  });

  it("guests are told how many more players are needed before anything else", () => {
    const w = mk({ isHost: false, myId: "u2", players: [p("u1", true), p("u2", true)] });
    expect(w.get(".lc-hint").text()).toBe('lobby.compact.need_more|{"count":1}');
  });

  it("guests get ready toggle and no start button", async () => {
    const w = mk({ isHost: false, myId: "u2" });
    expect(w.find(".lc-start").exists()).toBe(false);
    await w.get(".lc-ready").trigger("click");
    expect(w.emitted("toggle-ready")).toHaveLength(1);
  });

  it("more sheet: leave, add bot (host), app settings, report", async () => {
    const w = mk();
    // The sheet closes after every action by design, so reopen it each time.
    await w.get(".lc-more").trigger("click");
    await w.get(".lc-sheet-leave").trigger("click");
    await w.get(".lc-more").trigger("click");
    await w.get(".lc-sheet-bot").trigger("click");
    await w.get(".lc-more").trigger("click");
    await w.get(".lc-sheet-app").trigger("click");
    await w.get(".lc-more").trigger("click");
    await w.get(".lc-sheet-report").trigger("click");
    expect(w.emitted("leave")).toHaveLength(1);
    expect(w.emitted("add-bot")).toHaveLength(1);
    expect(w.emitted("open-app-settings")).toHaveLength(1);
    expect(openReport).toHaveBeenCalled();
  });

  it("forwards kicks from the player list", async () => {
    const w = mk();
    await w.get(".kick").trigger("click");
    expect(w.emitted("kick")).toEqual([["b1"]]);
  });
});
