// tests/components/lobby/LobbyRulesEditor.test.ts
//
// Replaces LobbySettingsDrawer.shuffle.test.ts. The editor now reads the pack
// roster from useCardPacks instead of fetching its own, so the roster is
// mocked here. What matters: shuffle gets the roster-validated selection,
// the host upgrades legacy keys once settings and roster are both present,
// and nobody writes cardPacks when the roster failed or they aren't host.
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Vue from "vue";

Object.assign(globalThis, Vue);
vi.unmock("vue");

const shuffle = vi.fn().mockResolvedValue({ packs: ["x"], total: 1 });
const updateSettings = vi.fn();
const notify = vi.fn();
const tiles = Vue.ref<any[]>([]);
const load = vi.fn(async () => {});
const synced = Vue.ref(true);

vi.stubGlobal("useI18n", () => ({ t: (key: string) => key }));
vi.stubGlobal("useNotifications", () => ({ notify }));
vi.mock("~/composables/useLobby", () => ({ useLobby: () => ({ mutations: { updateSettings }, lobbyDoc: { synced } }) }));
vi.mock("~/composables/useShufflePacks", () => ({
  useShufflePacks: () => ({ shuffle, pending: Vue.ref(false) }),
}));
vi.mock("~/composables/useCardPacks", () => ({
  useCardPacks: () => ({ tiles, load, seriesPrefix: Vue.computed(() => "") }),
}));
vi.mock("~/composables/useCompactLayout", () => ({ useCompactLayout: () => ({ isCompact: Vue.ref(false) }) }));

import LobbyRulesEditor from "~/components/lobby/LobbyRulesEditor.vue";

const BASE = "11111111-1111-4111-8111-111111111111";
const BLUE = "22222222-2222-4222-8222-222222222222";
const ROSTER = [
  { id: BASE, pack: "Base", white: 400, black: 100, total: 500, isDefault: true, legacyKey: "Raw Base" },
  { id: BLUE, pack: "Blue", white: 300, black: 80, total: 380, isDefault: false, legacyKey: null },
];

const settings = {
  maxPoints: 8, cardsPerPlayer: 10, maxPick: 3, manualDraw: false,
  hasPassword: false, lobbyName: "Test", isPrivate: false, cardPacks: [BASE, "Ghost"],
} as any;

const stubs = {
  UIcon: true,
  UModal: { props: ["open"], template: "<div v-if='open'><slot name='content' /></div>" },
  PackPickTile: {
    props: ["tile", "selected", "seriesPrefix", "disabled"],
    emits: ["toggle"],
    template: "<button class='tile-stub' :data-id='tile.id' :data-on='selected' @click=\"$emit('toggle', tile.id)\" />",
  },
};

function mk(over: Record<string, unknown> = {}) {
  return mount(LobbyRulesEditor, {
    props: { open: true, settings, isHost: true, lobbyId: "lobby-1", ...over } as any,
    global: { stubs },
  });
}

beforeEach(() => {
  shuffle.mockClear();
  updateSettings.mockClear();
  notify.mockClear();
  load.mockClear();
  tiles.value = ROSTER;
  synced.value = true;
});

describe("LobbyRulesEditor — packs", () => {
  it("hands the roster-validated selection to the shuffle", async () => {
    const w = mk();
    await flushPromises();
    await w.get(".lre-shuffle").trigger("click");
    expect(shuffle).toHaveBeenCalledWith([BASE]);
  });

  it("upgrades a pre-migration raw key to its pack id when the host opens it", async () => {
    mk({ settings: { ...settings, cardPacks: ["Raw Base", BLUE] } });
    await flushPromises();
    expect(updateSettings).toHaveBeenCalledWith({ cardPacks: [BASE, BLUE] });
  });

  it("waits for settings that arrive after mount before normalising", async () => {
    const w = mk({ settings: null });
    await flushPromises();
    expect(updateSettings).not.toHaveBeenCalled();
    await w.setProps({ settings: { ...settings, cardPacks: ["Raw Base"] } });
    await flushPromises();
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({ cardPacks: [BASE] });
  });

  it("waits for the doc to sync before seeding defaults over an empty selection", async () => {
    synced.value = false;
    mk({ settings: { ...settings, cardPacks: [] } });
    await flushPromises();
    expect(updateSettings).not.toHaveBeenCalled();
    synced.value = true;
    await flushPromises();
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({ cardPacks: [BASE] });
  });

  it("never writes cardPacks when the roster failed to load", async () => {
    tiles.value = [];
    mk({ settings: { ...settings, cardPacks: ["Raw Base"] } });
    await flushPromises();
    expect(updateSettings).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: "game.settings.fetch_packs_error" }));
  });

  it("writes nothing for a non-host and hides shuffle", async () => {
    const w = mk({ isHost: false, settings: { ...settings, cardPacks: ["Raw Base"] } });
    await flushPromises();
    expect(updateSettings).not.toHaveBeenCalled();
    expect(w.find(".lre-shuffle").exists()).toBe(false);
    expect(w.get(".lre-name").attributes("disabled")).toBeDefined();
  });

  it("toggles a tile into the selection", async () => {
    const w = mk({ settings: { ...settings, cardPacks: [BASE] } });
    await flushPromises();
    await w.get(`.tile-stub[data-id='${BLUE}']`).trigger("click");
    expect(updateSettings).toHaveBeenLastCalledWith({ cardPacks: [BASE, BLUE] });
  });

  it("resets to the default rotation", async () => {
    const w = mk({ settings: { ...settings, cardPacks: [BLUE] } });
    await flushPromises();
    await w.get(".lre-defaults").trigger("click");
    expect(updateSettings).toHaveBeenLastCalledWith({ cardPacks: [BASE] });
  });

  it("opens on the requested filter and lists only selected packs there", async () => {
    const w = mk({ settings: { ...settings, cardPacks: [BLUE] }, packFilter: "selected" });
    await flushPromises();
    expect(w.findAll(".tile-stub").map((x) => x.attributes("data-id"))).toEqual([BLUE]);
  });
});

describe("LobbyRulesEditor — rules", () => {
  it("steps points to win within 3–20", async () => {
    const w = mk({ settings: { ...settings, cardPacks: [BASE], maxPoints: 20 } });
    await flushPromises();
    expect(w.get(".lre-points-up").attributes("disabled")).toBeDefined();
    await w.get(".lre-points-down").trigger("click");
    expect(updateSettings).toHaveBeenLastCalledWith({ maxPoints: 19 });
  });

  it("flips a switch through updateSettings", async () => {
    const w = mk({ settings: { ...settings, cardPacks: [BASE] } });
    await flushPromises();
    await w.get(".lre-switch-private").trigger("click");
    expect(updateSettings).toHaveBeenLastCalledWith({ isPrivate: true });
  });
});
