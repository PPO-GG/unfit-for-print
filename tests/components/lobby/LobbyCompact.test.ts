import { describe, it, expect, vi } from "vitest";
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

const openReport = vi.fn();
vi.mock("~/composables/useReportProblem", () => ({
  useReportProblem: () => ({ open: openReport }),
  default: () => ({ open: openReport }),
}));
vi.mock("~/utils/shareInvite", () => ({ shareInvite: vi.fn(async () => "copied") }));
vi.mock("~/composables/useCompactLayout", () => ({
  useCompactLayout: () => ({ isCompact: Vue.ref(true), orientation: Vue.ref("portrait"), width: Vue.ref(375), height: Vue.ref(812) }),
}));
(globalThis as any).useDiscordSDK = () => ({ isDiscordActivity: Vue.ref(false) });
(globalThis as any).useRuntimeConfig = () => ({ public: { baseUrl: "https://unfit.cards" } });
(globalThis as any).useNotifications = () => ({ notify: vi.fn() });

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

  it("switches tabs and only renders the active panel", async () => {
    const w = mk();
    expect(w.find(".plist").exists()).toBe(true);
    await w.get('[data-tab="chat"]').trigger("click");
    expect(w.find(".chat").exists()).toBe(true);
    expect(w.find(".plist").exists()).toBe(false);
    await w.get('[data-tab="settings"]').trigger("click");
    await w.get(".summary").trigger("click");
    expect(w.emitted("edit-settings")).toHaveLength(1);
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
