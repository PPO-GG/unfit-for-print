// tests/components/lobby/LobbyHouseRules.test.ts
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import * as Vue from "vue";

Object.assign(globalThis, Vue);
vi.unmock("vue");
vi.stubGlobal("useI18n", () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    [key, ...Object.values(params ?? {})].join("|"),
}));

const ids = Array.from({ length: 10 }, (_, i) => `00000000-0000-4000-8000-00000000000${i}`.slice(-36));
const tiles = Vue.ref(
  ids.map((id, i) => ({ id, pack: `Pack ${i}`, white: 10, black: 2, total: 12, isDefault: false })),
);
vi.mock("~/composables/useCardPacks", () => ({
  useCardPacks: () => ({ tiles, load: vi.fn(), seriesPrefix: Vue.computed(() => "") }),
}));

import LobbyHouseRules from "~/components/lobby/LobbyHouseRules.vue";

const settings = {
  maxPoints: 8, cardsPerPlayer: 10, maxPick: 2, manualDraw: false,
  hasPassword: true, isPrivate: false, lobbyName: "x", cardPacks: ids.slice(0, 2),
} as any;

function mk(props: Record<string, unknown> = {}) {
  return mount(LobbyHouseRules, {
    props: { settings, isHost: true, ...props } as any,
    global: { stubs: { UIcon: true } },
  });
}

describe("LobbyHouseRules", () => {
  it("shows the four rule stats", () => {
    const vals = mk().findAll(".lhr-stat-val").map((s) => s.text());
    expect(vals).toEqual(["8", "10", "≤ 2", "lobby.rules.draw_auto"]);
  });

  it("flags a password but not privacy when only the password is set", () => {
    const w = mk();
    expect(w.find(".lhr-flag--password").exists()).toBe(true);
    expect(w.find(".lhr-flag--private").exists()).toBe(false);
  });

  it("tallies and names the selected packs", () => {
    const w = mk();
    expect(w.get(".lhr-tally").text()).toBe("lobby.rules.pack_tally|2|20|4");
    expect(w.findAll(".lhr-pack").map((p) => p.text())).toEqual(["Pack 0", "Pack 1"]);
  });

  it("says All packs for an empty selection, since game start deals them all", () => {
    const w = mk({ settings: { ...settings, cardPacks: [] } });
    expect(w.get(".lhr-all").text()).toBe("lobby.rules.all_packs");
  });

  it("caps the list at 8 and opens the editor on Selected from +N more", async () => {
    const w = mk({ settings: { ...settings, cardPacks: ids } });
    expect(w.findAll(".lhr-pack")).toHaveLength(8);
    await w.get(".lhr-more").trigger("click");
    expect(w.emitted("edit")).toEqual([["selected"]]);
  });

  it("gives the host Edit and Shuffle, and a guest Details only", async () => {
    const host = mk();
    expect(host.get(".lhr-edit").text()).toContain("lobby.rules.edit");
    await host.get(".lhr-shuffle").trigger("click");
    expect(host.emitted("shuffle")).toHaveLength(1);

    const guest = mk({ isHost: false });
    expect(guest.get(".lhr-edit").text()).toContain("lobby.rules.details");
    expect(guest.find(".lhr-shuffle").exists()).toBe(false);
  });

  it("renders rows whose short names collide without duplicate-key warnings", async () => {
    // A legacy name entry equal to a resolved id's label yields two "Pack 5"
    // rows. Vue only checks keys in the middle of a keyed patch (after the
    // shared head and tail), so the update has to change the middle.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const w = mk({ settings: { ...settings, cardPacks: [ids[0], ids[1], ids[2]] } });
    await w.setProps({ settings: { ...settings, cardPacks: [ids[0], ids[5], "Pack 5", ids[2]] } });
    expect(w.findAll(".lhr-pack").map((p) => p.text())).toEqual(["Pack 0", "Pack 5", "Pack 5", "Pack 2"]);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("Duplicate keys"))).toBe(false);
    warn.mockRestore();
  });

  it("disables Shuffle mid-roll", () => {
    expect(mk({ shuffling: true }).get(".lhr-shuffle").attributes("disabled")).toBeDefined();
  });
});
