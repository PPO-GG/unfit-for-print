// tests/components/lobby/LobbyStartBar.test.ts
//
// The ready bar: utilities on the left, one pip per player, a status line,
// and on the right exactly one primary action at a time. These tests pin the
// action states, because getting them wrong either hides Start from the host
// or shows two competing primary buttons.
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import * as Vue from "vue";

Object.assign(globalThis, Vue);
vi.unmock("vue");
// Echo key + params so assertions can see interpolated values.
vi.stubGlobal("useI18n", () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    [key, ...Object.values(params ?? {})].join("|"),
}));

import LobbyStartBar from "~/components/lobby/LobbyStartBar.vue";

const p = (userId: string, ready: boolean, playerType = "player") =>
  ({ $id: userId, userId, name: `N-${userId}`, ready, playerType }) as any;

function mk(props: Partial<{ players: any[]; myId: string; isHost: boolean; isStarting: boolean }> = {}) {
  return mount(LobbyStartBar, {
    props: { players: [], myId: "u1", isHost: true, isStarting: false, ...props },
    global: { stubs: { UIcon: true } },
  });
}

describe("LobbyStartBar — utilities", () => {
  it("emits leave and open-app-settings from the icon buttons", async () => {
    const w = mk();
    await w.get(".lsb-leave").trigger("click");
    await w.get(".lsb-app-settings").trigger("click");
    expect(w.emitted("leave")).toHaveLength(1);
    expect(w.emitted("open-app-settings")).toHaveLength(1);
    expect(w.get(".lsb-leave").attributes("aria-label")).toBe("lobby.bar.leave");
  });
});

describe("LobbyStartBar — pips", () => {
  it("renders one pip per player, filled when ready, bots always filled", () => {
    const w = mk({ players: [p("u1", true), p("u2", false), p("b1", false, "bot")] });
    const pips = w.findAll(".lsb-pip");
    expect(pips).toHaveLength(3);
    expect(pips.map((x) => x.classes("lsb-pip--ready"))).toEqual([true, false, true]);
    expect(pips[1]!.attributes("title")).toBe("N-u2");
  });

  it("caps at 10 pips and adds +N", () => {
    const players = Array.from({ length: 13 }, (_, i) => p(`u${i}`, false));
    const w = mk({ players });
    expect(w.findAll(".lsb-pip:not(.lsb-pip--more)")).toHaveLength(10);
    expect(w.get(".lsb-pip--more").text()).toBe("+3");
  });
});

describe("LobbyStartBar — status", () => {
  it("asks for more players below three", () => {
    const w = mk({ players: [p("u1", true)] });
    expect(w.get(".lsb-label-main").text()).toBe("lobby.bar.need_more|2");
  });

  it("names who it is waiting on, you first, capped at three", () => {
    const players = [p("u1", false), p("u2", false), p("u3", false), p("u4", false), p("u5", false)];
    const w = mk({ players, myId: "u3" });
    expect(w.get(".lsb-label-main").text()).toBe("lobby.bar.ready_count|0|5");
    const sub = w.get(".lsb-label-sub").text();
    expect(sub).toContain("lobby.bar.you, N-u1, N-u2");
    expect(sub).toContain("lobby.bar.and_more|2");
  });

  it("shows dealing while starting", () => {
    const w = mk({ players: [p("u1", true), p("u2", true), p("u3", true)], isStarting: true });
    expect(w.get(".lsb-label-main").text()).toBe("lobby.bar.dealing");
  });

  it("counts down once the room becomes all-ready", async () => {
    vi.useFakeTimers();
    const w = mk({ players: [p("u1", true), p("u2", false), p("u3", true)] });
    await w.setProps({ players: [p("u1", true), p("u2", true), p("u3", true)] });
    expect(w.get(".lsb-label-main").text()).toBe("lobby.bar.starting_in|5");
    expect(w.get(".lsb-label-sub").text()).toBe("lobby.bar.everyone_in");
    w.unmount();
    vi.useRealTimers();
  });

  it("does not claim to be dealing when a room loads already all-ready", () => {
    const w = mk({ players: [p("u1", true), p("u2", true), p("u3", true)] });
    expect(w.get(".lsb-label-main").text()).toBe("lobby.bar.ready_count|3|3");
  });
});

describe("LobbyStartBar — actions", () => {
  it("offers a primary Ready up when you're not ready, and no Start", () => {
    const w = mk({ players: [p("u1", false), p("u2", true), p("u3", true)] });
    expect(w.get(".lsb-ready").classes()).toContain("lb-btn--primary");
    expect(w.find(".lsb-start").exists()).toBe(false);
    expect(w.findAll(".lb-btn--primary")).toHaveLength(1);
  });

  it("turns Ready into a secondary Not ready that still toggles", async () => {
    const w = mk({ players: [p("u1", true), p("u2", false), p("u3", false)] });
    const btn = w.get(".lsb-unready");
    expect(btn.classes()).toContain("lb-btn--secondary");
    await btn.trigger("click");
    expect(w.emitted("toggle-ready")).toHaveLength(1);
  });

  it("shows the host a disabled Start until everyone is ready", () => {
    const w = mk({ players: [p("u1", true), p("u2", false), p("u3", true)] });
    const start = w.get(".lsb-start");
    expect(start.attributes("disabled")).toBeDefined();
    expect(start.classes()).not.toContain("lb-btn--primary");
    expect(w.findAll(".lb-btn--primary")).toHaveLength(0);
  });

  it("makes Start the single primary once the game can start", async () => {
    const w = mk({ players: [p("u1", true), p("u2", true), p("u3", true)] });
    const start = w.get(".lsb-start");
    expect(start.attributes("disabled")).toBeUndefined();
    expect(w.findAll(".lb-btn--primary")).toHaveLength(1);
    await start.trigger("click");
    expect(w.emitted("start")).toHaveLength(1);
  });

  it("never shows Start to a guest", () => {
    const w = mk({ isHost: false, players: [p("u1", true), p("u2", true), p("u3", true)] });
    expect(w.find(".lsb-start").exists()).toBe(false);
  });
});
