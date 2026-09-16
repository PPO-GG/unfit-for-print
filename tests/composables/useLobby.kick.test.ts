import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// Kicking used to touch only the Y.Doc: the kicked player was never told, and
// their Postgres row survived, so a refresh seated them again.

const state = vi.hoisted(() => ({
  players: new Map<string, string>(),
  activityFetch: vi.fn(),
  kickPlayer: vi.fn(),
  skipPlayer: vi.fn(),
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
  }),
}));

vi.mock("~/composables/useYjsGameEngine", () => ({
  useYjsGameEngine: () => ({ skipPlayer: state.skipPlayer }),
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
