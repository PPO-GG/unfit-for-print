import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// Kicking used to touch only the Y.Doc: the kicked player was never told, and
// their Postgres row survived, so a refresh seated them again. The game reset
// below had the same doc-only gap with the lobby row's status.

const state = vi.hoisted(() => ({
  players: new Map<string, string>(),
  activityFetch: vi.fn(),
  kickPlayer: vi.fn(),
  skipPlayer: vi.fn(),
  resetGame: vi.fn(),
  isHost: { value: true },
  initializeLobby: vi.fn(),
}));

vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: state.activityFetch }));

vi.mock("~/composables/useLobbyDoc", () => ({
  useLobbyDoc: () => ({
    doc: { value: {} },
    getMeta: () => new Map(),
    getPlayers: () => state.players,
    lobbyCode: { value: "ABCD" },
    synced: { value: true },
  }),
}));

vi.mock("~/composables/useLobbyMutations", () => ({
  useLobbyMutations: () => ({
    kickPlayer: state.kickPlayer,
    initializeLobby: state.initializeLobby,
  }),
}));

vi.mock("~/composables/useLobbyReactive", () => ({
  useLobbyReactive: () => ({
    playerList: { value: [] },
    gameState: { value: null },
    myHand: { value: [] },
    isHost: state.isHost,
  }),
}));

vi.mock("~/composables/useYjsGameEngine", () => ({
  useYjsGameEngine: () => ({ skipPlayer: state.skipPlayer, resetGame: state.resetGame }),
}));

vi.mock("~/composables/usePlayers", () => ({
  usePlayers: () => ({ getUserAvatarUrl: () => "" }),
}));

vi.mock("~/composables/useCards", () => ({
  useCards: () => ({ fetchDefaultPacks: async () => ["pack-1"] }),
}));

import { useLobby } from "~/composables/useLobby";
import { useUserStore } from "~/stores/userStore";

describe("useLobby.kickPlayer", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal("useDiscordSDK", () => ({ isDiscordActivity: { value: false } }));
    vi.clearAllMocks();
    state.players.clear();
    state.players.set("alice", JSON.stringify({ userId: "alice", name: "Alice" }));
    state.activityFetch.mockResolvedValue({ success: true });
  });

  it("kicks through the marker-writing mutation, then removes the player's row", async () => {
    await useLobby().kickPlayer("lobby-1", "alice");

    expect(state.skipPlayer).toHaveBeenCalledWith("alice");
    expect(state.kickPlayer).toHaveBeenCalledWith("alice", "Alice");
    expect(state.activityFetch).toHaveBeenCalledWith("/api/lobby/kick", {
      method: "POST",
      body: { lobbyId: "lobby-1", userId: "alice" },
    });
  });

  it("still kicks in the game when the server call fails", async () => {
    state.activityFetch.mockRejectedValue(new Error("offline"));

    await expect(useLobby().kickPlayer("lobby-1", "alice")).resolves.toBeUndefined();
    expect(state.kickPlayer).toHaveBeenCalledWith("alice", "Alice");
  });
});

describe("useLobby.resetGameState", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal("useDiscordSDK", () => ({ isDiscordActivity: { value: false } }));
    vi.clearAllMocks();
    state.isHost.value = true;
    state.activityFetch.mockResolvedValue({ success: true });
  });

  it("resets the game, then puts the lobby row back to waiting", async () => {
    await useLobby().resetGameState("lobby-1");
    expect(state.resetGame).toHaveBeenCalledTimes(1);
    expect(state.activityFetch).toHaveBeenCalledWith("/api/lobby/reset", {
      method: "POST",
      body: { lobbyId: "lobby-1" },
    });
  });

  // A guest resets only as a fallback when the host's client is gone; the
  // route is host-only, so the guest doesn't call it.
  it("doesn't call the host-only route for a guest", async () => {
    state.isHost.value = false;
    await useLobby().resetGameState("lobby-1");
    expect(state.resetGame).toHaveBeenCalledTimes(1);
    expect(state.activityFetch).not.toHaveBeenCalled();
  });

  it("still resets the game when the server call fails", async () => {
    state.activityFetch.mockRejectedValue(new Error("offline"));
    await expect(useLobby().resetGameState("lobby-1")).resolves.toBe(true);
    expect(state.resetGame).toHaveBeenCalledTimes(1);
  });
});

// The sync server drops a doc once everyone disconnects; the host coming back
// rebuilds it from the lobby row rather than landing in an empty shell.
describe("useLobby.restoreLobbyDoc", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal("useDiscordSDK", () => ({ isDiscordActivity: { value: false } }));
    vi.clearAllMocks();
  });

  it("rebuilds the lobby with the host and the row's name and privacy", async () => {
    useUserStore().user = { id: "host-1", name: "Mynd", avatarUrl: "a.png", activeDecoration: "d1" } as any;

    await useLobby().restoreLobbyDoc({
      id: "lobby-1", code: "ABCD", hostUserId: "host-1", lobbyName: "Friday Night", isPrivate: false,
    } as any);

    expect(state.initializeLobby).toHaveBeenCalledTimes(1);
    expect(state.initializeLobby.mock.calls[0]![0]).toMatchObject({
      code: "ABCD",
      hostUserId: "host-1",
      hostName: "Mynd",
      hostAvatar: "a.png",
      hostActiveDecoration: "d1",
      settings: { lobbyName: "Friday Night", isPrivate: false, cardPacks: ["pack-1"], maxPoints: 10 },
    });
  });

  it("only the host rebuilds", async () => {
    useUserStore().user = { id: "guest-1", name: "Sam" } as any;
    await useLobby().restoreLobbyDoc({ id: "lobby-1", code: "ABCD", hostUserId: "host-1" } as any);
    expect(state.initializeLobby).not.toHaveBeenCalled();
  });
});
