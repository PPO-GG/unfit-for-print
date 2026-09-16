import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// The host handoff in leaveLobby: the Y.Doc must promote the same player the
// server made host, and must never make a guest host.

const state = vi.hoisted(() => ({
  meta: new Map<string, unknown>(),
  players: new Map<string, string>(),
  activityFetch: vi.fn(),
  disconnect: vi.fn(),
}));

vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: state.activityFetch }));

vi.mock("~/composables/useLobbyDoc", () => ({
  useLobbyDoc: () => ({
    connect: async () => {},
    disconnect: state.disconnect,
    doc: { value: { transact: (fn: () => void) => fn() } },
    getMeta: () => state.meta,
    getPlayers: () => state.players,
    lobbyCode: { value: "ABCD" },
    synced: { value: true },
  }),
}));

vi.mock("~/composables/useLobbyMutations", () => ({
  useLobbyMutations: () => ({
    removePlayer: (userId: string) => state.players.delete(userId),
  }),
}));

vi.mock("~/composables/useLobbyReactive", () => ({
  useLobbyReactive: () => ({
    playerList: { value: [] },
    gameState: { value: null },
    myHand: { value: [] },
  }),
}));

vi.mock("~/composables/useYjsGameEngine", () => ({
  useYjsGameEngine: () => ({ handlePlayerLeave: vi.fn() }),
}));

vi.mock("~/composables/usePlayers", () => ({
  usePlayers: () => ({ getUserAvatarUrl: () => "" }),
}));

import { useLobby } from "~/composables/useLobby";

function seat(id: string, provider: string, playerType = "player") {
  state.players.set(
    id,
    JSON.stringify({ userId: id, name: id, isHost: id === "host", provider, playerType }),
  );
}

function serverAnswers(body: unknown) {
  state.activityFetch.mockImplementation(async (url: string) =>
    url === "/api/lobby/leave" ? body : null,
  );
}

const hostFlag = (id: string) => JSON.parse(state.players.get(id)!).isHost;

describe("useLobby.leaveLobby host handoff", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal("useDiscordSDK", () => ({ isDiscordActivity: { value: false } }));
    vi.clearAllMocks();
    state.meta.clear();
    state.meta.set("status", "waiting");
    state.meta.set("hostUserId", "host");
    state.players.clear();
    seat("host", "unfit");
  });

  it("promotes the player the server chose, not the first one in the map", async () => {
    seat("guest", "anonymous");
    seat("member", "discord");
    serverAnswers({ success: true, newHostUserId: "member", lobbyClosed: false });

    await useLobby().leaveLobby("lobby-1", "host");

    expect(state.meta.get("hostUserId")).toBe("member");
    expect(hostFlag("member")).toBe(true);
    expect(hostFlag("guest")).toBe(false);
    expect(state.meta.has("closedAt")).toBe(false);
  });

  it("marks the lobby closed when the server closed it", async () => {
    seat("guest", "anonymous");
    serverAnswers({ success: true, newHostUserId: null, lobbyClosed: true });

    await useLobby().leaveLobby("lobby-1", "host");

    expect(state.meta.get("closedAt")).toEqual(expect.any(Number));
    expect(state.meta.get("hostUserId")).toBe("host");
    expect(state.disconnect).toHaveBeenCalled();
  });

  it("skips guests itself when the server never answered", async () => {
    seat("guest", "anonymous");
    seat("member", "discord");
    state.activityFetch.mockRejectedValue(new Error("offline"));

    await useLobby().leaveLobby("lobby-1", "host");

    expect(state.meta.get("hostUserId")).toBe("member");
  });

  it("closes the lobby itself when the server never answered and only guests remain", async () => {
    seat("guest", "anonymous");
    state.activityFetch.mockRejectedValue(new Error("offline"));

    await useLobby().leaveLobby("lobby-1", "host");

    expect(state.meta.get("closedAt")).toEqual(expect.any(Number));
    expect(state.meta.get("hostUserId")).toBe("host");
  });
});
