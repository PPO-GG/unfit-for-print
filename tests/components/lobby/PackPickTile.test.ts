import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import * as Vue from "vue";

Object.assign(globalThis, Vue);
vi.unmock("vue");
vi.stubGlobal("useI18n", () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    [key, ...Object.values(params ?? {})].join("|"),
}));

import PackPickTile from "~/components/lobby/PackPickTile.vue";

const tile = {
  id: "id-1",
  pack: "Cards Against Humanity: Base Pack",
  white: 1196,
  black: 221,
  total: 1417,
  isDefault: true,
  official: true,
  nsfw: false,
  description: "The basic box",
} as any;

const stubs = { UIcon: true, UTooltip: { props: ["text"], template: "<div class='tip' :data-text='text'><slot /></div>" } };

function mk(props: Record<string, unknown> = {}) {
  return mount(PackPickTile, {
    props: { tile, selected: false, seriesPrefix: "Cards Against Humanity", ...props } as any,
    global: { stubs },
  });
}

describe("PackPickTile", () => {
  it("splits the series off the name the same way Labs does", () => {
    const w = mk();
    expect(w.get(".ppt-series").text()).toBe("Cards Against Humanity");
    expect(w.get(".ppt-name").text()).toBe("Base Pack");
  });

  it("shows answer and prompt counts and the right marks", () => {
    const w = mk();
    expect(w.get(".ppt-counts").text()).toContain("lobby.editor.answers_short|1196");
    expect(w.get(".ppt-counts").text()).toContain("lobby.editor.prompts_short|221");
    expect(w.findAll(".ppt-mark").map((m) => m.text())).toEqual(["lobby.editor.mark_default", "labs.pack_official"]);
  });

  it("reflects selection in class and aria-pressed, and emits its id", async () => {
    const w = mk({ selected: true });
    const btn = w.get("button.ppt");
    expect(btn.classes()).toContain("ppt--on");
    expect(btn.attributes("aria-pressed")).toBe("true");
    await btn.trigger("click");
    expect(w.emitted("toggle")).toEqual([["id-1"]]);
  });

  it("carries the description as its tooltip", () => {
    expect(mk().get(".tip").attributes("data-text")).toBe("The basic box");
  });

  it("does nothing when disabled", async () => {
    const w = mk({ disabled: true });
    await w.get("button.ppt").trigger("click");
    expect(w.emitted("toggle")).toBeUndefined();
  });
});
