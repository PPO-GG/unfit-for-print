import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import LobbyStartBar from "~/components/lobby/LobbyStartBar.vue";

Object.assign(globalThis, { computed, onBeforeUnmount, ref, watch });

const props = {
  lobbyName: "My Lobby",
  players: [],
  myId: "player-1",
  isHost: true,
  isStarting: false,
  maxSeats: 8,
};

describe("LobbyStartBar", () => {
  it("centers the lobby name and emits the relocated leave and settings actions", async () => {
    const wrapper = mount(LobbyStartBar, { props });

    expect(wrapper.get(".lsb-lobby-name").text()).toBe("My Lobby");

    await wrapper.get(".lsb-btn--leave").trigger("click");
    await wrapper.get(".lsb-btn--settings").trigger("click");

    expect(wrapper.emitted("leave")).toHaveLength(1);
    expect(wrapper.emitted("open-settings")).toHaveLength(1);
  });
});
