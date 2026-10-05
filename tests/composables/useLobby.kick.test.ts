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
  useLobbyMutations: () => ({ kickPlayer: state.kickPlayer }),
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

import { useLobby } from "~/composables/useLobby";

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
