import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import * as Vue from "vue";

Object.assign(globalThis, Vue);
vi.unmock("vue");
vi.mock("~/composables/usePlayerAvatar", () => ({ getPlayerAvatarUrl: () => null }));

import LobbyPlayerList from "~/components/lobby/LobbyPlayerList.vue";

const players = [
  { $id: "h1", userId: "h1", name: "Host", isHost: true, playerType: "player" },
  { $id: "u2", userId: "u2", name: "Sam", isHost: false, playerType: "player" },
  { $id: "u3", userId: "u3", name: "Ed", isHost: false, playerType: "spectator" },
  { $id: "b1", userId: "b1", name: "SnappySquid", isHost: false, playerType: "bot" },
] as any;

const mk = (isHostUser: boolean) =>
  mount(LobbyPlayerList, {
    props: { players, maxSeats: 6, isHostUser },
    global: { stubs: { AvatarDecoration: { template: "<div><slot /></div>" } } },
  });

describe("LobbyPlayerList — removing players", () => {
  it("gives the host a remove button on everyone but themselves", () => {
    const w = mk(true);
    const labels = w.findAll(".lpl-kick").map((b) => b.attributes("aria-label"));
    expect(labels).toEqual(["Remove Sam", "Remove Ed", "Remove SnappySquid"]);
  });

  it("gives everyone else none", () => {
    expect(mk(false).findAll(".lpl-kick")).toHaveLength(0);
  });

  it("emits the player's id", async () => {
    const w = mk(true);
    await w.findAll(".lpl-kick")[0]!.trigger("click");
    expect(w.emitted("kick")).toEqual([["u2"]]);
  });
});
