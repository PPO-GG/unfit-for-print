// tests/components/lobby/LobbyPlayerGrid.test.ts
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Vue from "vue";

Object.assign(globalThis, Vue);
vi.unmock("vue");
vi.stubGlobal("useI18n", () => ({ t: (key: string) => key }));
const notify = vi.fn();
vi.stubGlobal("useNotifications", () => ({ notify }));
vi.stubGlobal("useRuntimeConfig", () => ({ public: { baseUrl: "https://unfit.cards" } }));

import LobbyPlayerGrid from "~/components/lobby/LobbyPlayerGrid.vue";

const writeText = vi.fn().mockResolvedValue(undefined);
beforeEach(() => {
  writeText.mockClear();
  notify.mockClear();
  Object.defineProperty(globalThis.navigator, "clipboard", { value: { writeText }, configurable: true });
});

const p = (userId: string, over: Record<string, unknown> = {}) =>
  ({ $id: userId, userId, name: userId, isHost: false, playerType: "player", ...over }) as any;

const CardStub = {
  name: "LobbyPlayerCard",
  props: ["player", "isHostUser", "isMe"],
  emits: ["kick", "add-bot", "invite"],
  template: `<div class="card-stub" :data-me="isMe" @click="$emit('invite')" />`,
};

function mk(players: any[], maxSeats: number) {
  return mount(LobbyPlayerGrid, {
    props: { code: "QX7K", lobbyName: "Friday", players, myId: "u2", isHostUser: true, maxSeats },
    global: { stubs: { UIcon: true, LobbyPlayerCard: CardStub } },
  });
}

describe("LobbyPlayerGrid", () => {
  it("renders every player plus the open seats up to maxSeats", () => {
    const w = mk([p("u1", { isHost: true }), p("u2")], 3);
    const cards = w.findAllComponents(CardStub);
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.props("player")?.userId ?? null)).toEqual(["u1", "u2", null]);
  });

  it("flags only the current user's card as theirs", () => {
    const w = mk([p("u1"), p("u2")], 3);
    expect(w.findAllComponents(CardStub).map((c) => !!c.props("isMe"))).toEqual([false, true, false]);
  });

  it("copies the code and the invite link", async () => {
    const w = mk([p("u1")], 3);
    await w.get(".lpg-copy-code").trigger("click");
    await w.get(".lpg-copy-link").trigger("click");
    await flushPromises();
    expect(writeText.mock.calls).toEqual([["QX7K"], ["https://unfit.cards/game/QX7K"]]);
    expect(notify.mock.calls.map(([n]) => n.title)).toEqual(["lobby.code_copied", "lobby.link_copied"]);
  });

  it("copies the invite link when an open seat asks to invite", async () => {
    const w = mk([p("u1")], 3);
    await w.findAll(".card-stub")[1]!.trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith("https://unfit.cards/game/QX7K");
  });

  it("switches to the crowded grid past 8 players", () => {
    const players = Array.from({ length: 9 }, (_, i) => p(`u${i}`));
    expect(mk(players, 10).get(".lpg-grid").classes()).toContain("lpg-grid--crowded");
  });
});
