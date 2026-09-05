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

  it("displays progress toward minimum of 3, and shows N/N once minimum is met", () => {
    // 1 player -> 1/3
    const w1 = mount(LobbyStartBar, {
      props: { ...props, players: [{ $id: "1", name: "Host" }] as any },
    });
    expect(w1.get(".lsb-ring-count").text().replace(/\s+/g, "")).toBe("1/3");

    // 2 players -> 2/3
    const w2 = mount(LobbyStartBar, {
      props: {
        ...props,
        players: [{ $id: "1", name: "Host" }, { $id: "2", name: "P2" }] as any,
      },
    });
    expect(w2.get(".lsb-ring-count").text().replace(/\s+/g, "")).toBe("2/3");

    // 3 players -> 3/3
    const w3 = mount(LobbyStartBar, {
      props: {
        ...props,
        players: [
          { $id: "1", name: "Host" },
          { $id: "2", name: "P2" },
          { $id: "3", name: "P3" },
        ] as any,
      },
    });
    expect(w3.get(".lsb-ring-count").text().replace(/\s+/g, "")).toBe("3/3");

    // 6 players -> 6/6
    const w6 = mount(LobbyStartBar, {
      props: {
        ...props,
        players: Array.from({ length: 6 }, (_, i) => ({
          $id: `${i}`,
          name: `P${i}`,
        })) as any,
      },
    });
    expect(w6.get(".lsb-ring-count").text().replace(/\s+/g, "")).toBe("6/6");
  });
});
