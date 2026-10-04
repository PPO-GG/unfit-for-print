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

import CompactMenuSheet from "~/components/game/compact/CompactMenuSheet.vue";

const stubs = {
  UDrawer: { props: ["open"], template: '<div v-if="open"><slot name="body" /></div>' },
  SettingsSlideover: { props: ["open"], template: '<div class="settings-stub" :data-open="String(open)" />' },
  GameSidebarContent: {
    template:
      "<div class=\"gsc\"><button class=\"gsc-skip\" @click=\"$emit('skip-judge')\" /><button class=\"gsc-convert\" @click=\"$emit('convert-spectator', 'u9')\" /></div>",
  },
  Icon: true,
};
const props = {
  open: true,
  lobby: { id: "l1", code: "3046EP" } as any,
  players: [],
  state: null,
  settings: null,
  isHost: true,
  myId: "u1",
};

describe("CompactMenuSheet", () => {
  it("opens the report modal and closes itself", async () => {
    const w = mount(CompactMenuSheet, { props, global: { stubs } });
    await w.get(".cms-report").trigger("click");
    expect(openReport).toHaveBeenCalled();
    expect(w.emitted("update:open")).toEqual([[false]]);
  });

  it("opens My settings", async () => {
    const w = mount(CompactMenuSheet, { props, global: { stubs } });
    await w.get(".cms-settings").trigger("click");
    expect(w.get(".settings-stub").attributes("data-open")).toBe("true");
  });

  it("re-emits host actions from the sidebar content", async () => {
    const w = mount(CompactMenuSheet, { props, global: { stubs } });
    await w.get(".gsc-skip").trigger("click");
    await w.get(".gsc-convert").trigger("click");
    expect(w.emitted("skip-judge")).toHaveLength(1);
    expect(w.emitted("convert-spectator")).toEqual([["u9"]]);
  });
});
