import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import * as Vue from "vue";

Object.assign(globalThis, Vue);
vi.unmock("vue");
vi.stubGlobal("useI18n", () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    [key, ...Object.values(params ?? {})].join("|"),
}));
vi.mock("~/composables/usePlayerAvatar", () => ({ getPlayerAvatarUrl: () => null }));

import LobbyPlayerCard from "~/components/lobby/LobbyPlayerCard.vue";

const person = (over: Record<string, unknown> = {}) =>
  ({ $id: "u2", userId: "u2", name: "Sam", isHost: false, playerType: "player", ready: false, ...over }) as any;

function mk(props: Record<string, unknown>) {
  return mount(LobbyPlayerCard, {
    props: { player: null, isHostUser: false, ...props } as any,
    global: { stubs: { UIcon: true, AvatarDecoration: { template: "<div><slot /></div>" } } },
  });
}

describe("LobbyPlayerCard — a player", () => {
  it("bands the card in the player's colour", () => {
    const w = mk({ player: person() });
    expect(w.get(".lpc").attributes("style")).toContain("--lpc-accent: #a78bfa");
  });

  it("stamps READY only when ready", () => {
    expect(mk({ player: person() }).find(".lpc-stamp").exists()).toBe(false);
    const ready = mk({ player: person({ ready: true }) });
    expect(ready.get(".lpc-stamp").text()).toBe("lobby.cards.ready_stamp");
    expect(ready.get(".lpc").classes()).toContain("lpc--ready");
  });

  it("tags bots and counts them as ready without a stamp", () => {
    const w = mk({ player: person({ playerType: "bot", name: "Jev" }) });
    expect(w.get(".lpc-tag--bot").text()).toBe("lobby.cards.bot");
    expect(w.get(".lpc-status").text()).toBe("lobby.cards.always_ready");
    expect(w.find(".lpc-stamp").exists()).toBe(false);
  });

  it("marks your own card", () => {
    const w = mk({ player: person(), isMe: true });
    expect(w.get(".lpc").classes()).toContain("lpc--me");
    expect(w.get(".lpc-tag--me").text()).toBe("lobby.cards.you");
  });

  it("crowns the host", () => {
    expect(mk({ player: person({ isHost: true }) }).get(".lpc-name").text()).toContain("👑");
  });
});

describe("LobbyPlayerCard — kicking", () => {
  it("lets the host remove someone else and emits their id", async () => {
    const w = mk({ player: person(), isHostUser: true });
    const kick = w.get(".lpc-kick");
    expect(kick.attributes("aria-label")).toBe("lobby.cards.remove|Sam");
    await kick.trigger("click");
    expect(w.emitted("kick")).toEqual([["u2"]]);
  });

  it("never offers the host a kick on the host's own card", () => {
    expect(mk({ player: person({ isHost: true }), isHostUser: true }).find(".lpc-kick").exists()).toBe(false);
  });

  it("never offers a guest a kick", () => {
    expect(mk({ player: person(), isHostUser: false }).find(".lpc-kick").exists()).toBe(false);
  });
});

describe("LobbyPlayerCard — open seat", () => {
  it("gives the host Add bot and Invite", async () => {
    const w = mk({ player: null, isHostUser: true });
    expect(w.get(".lpc").classes()).toContain("lpc--open");
    await w.get(".lpc-add-bot").trigger("click");
    await w.get(".lpc-invite").trigger("click");
    expect(w.emitted("add-bot")).toHaveLength(1);
    expect(w.emitted("invite")).toHaveLength(1);
  });

  it("gives a guest only Invite", () => {
    const w = mk({ player: null, isHostUser: false });
    expect(w.find(".lpc-add-bot").exists()).toBe(false);
    expect(w.find(".lpc-invite").exists()).toBe(true);
  });
});
