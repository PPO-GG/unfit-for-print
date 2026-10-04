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

import CompactActionBar from "~/components/game/compact/CompactActionBar.vue";

describe("CompactActionBar", () => {
  it("disables a state with no action and never emits", async () => {
    const w = mount(CompactActionBar, {
      props: { state: { labelKey: "compact.reveal_all", action: null, tone: "muted" } },
    });
    const btn = w.get("button");
    expect(btn.attributes("disabled")).toBeDefined();
    expect(btn.text()).toBe("compact.reveal_all");
    await btn.trigger("click");
    expect(w.emitted("act")).toBeUndefined();
  });

  it("emits the action and shows params", async () => {
    const w = mount(CompactActionBar, {
      props: { state: { labelKey: "compact.crown", action: "crown", tone: "judge" } },
    });
    await w.get("button").trigger("click");
    expect(w.emitted("act")).toEqual([["crown"]]);
    expect(w.get("button").classes()).toContain("compact-action-btn--judge");
  });

  it("passes params to the translator", () => {
    const w = mount(CompactActionBar, {
      props: { state: { labelKey: "compact.select_more", params: { count: 2 }, action: null, tone: "muted" } },
    });
    expect(w.get("button").text()).toBe('compact.select_more|{"count":2}');
  });
});
