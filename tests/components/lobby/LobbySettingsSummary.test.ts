// tests/components/lobby/LobbySettingsSummary.test.ts
//
// The lobby-room summary is the second home of the host's "Shuffle packs"
// control (the settings drawer is the first). It is presentational — the roll
// happens in useShufflePacks — so what matters here is that only the host sees
// the control, that it emits, and that it goes inert mid-roll so an impatient
// host cannot stack two rolls against the same Y.Doc write.
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import LobbySettingsSummary from "~/components/lobby/LobbySettingsSummary.vue";

Object.assign(globalThis, { computed, ref });
vi.stubGlobal("useI18n", () => ({ t: (key: string) => key }));

const settings = {
  maxPoints: 8,
  cardsPerPlayer: 10,
  maxPick: 3,
  manualDraw: false,
  hasPassword: false,
  cardPacks: ["CAH Base Set", "CAH: Blue Box Expansion"],
} as any;

const stubs = { UIcon: true };

describe("LobbySettingsSummary — shuffle control", () => {
  it("emits shuffle when the host clicks it", async () => {
    const wrapper = mount(LobbySettingsSummary, {
      props: { settings, isHost: true },
      global: { stubs },
    });

    await wrapper.get(".lss-shuffle-link").trigger("click");

    expect(wrapper.emitted("shuffle")).toHaveLength(1);
  });

  it("hides the control from non-hosts", () => {
    const wrapper = mount(LobbySettingsSummary, {
      props: { settings, isHost: false },
      global: { stubs },
    });

    expect(wrapper.find(".lss-shuffle-link").exists()).toBe(false);
  });

  it("disables the control while a roll is in flight", () => {
    const wrapper = mount(LobbySettingsSummary, {
      props: { settings, isHost: true, shuffling: true },
      global: { stubs },
    });

    expect(
      wrapper.get(".lss-shuffle-link").attributes("disabled"),
    ).toBeDefined();
  });

  it("still lists the active packs alongside the control", () => {
    const wrapper = mount(LobbySettingsSummary, {
      props: { settings, isHost: true },
      global: { stubs },
    });

    expect(wrapper.findAll(".lss-pack-chip")).toHaveLength(2);
  });
});
