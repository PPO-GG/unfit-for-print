import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useUserStore } from "~/stores/userStore";

const activityState = vi.hoisted(() => ({
  account: {
    createAnonymousSession: vi.fn(),
    get: vi.fn(),
    getSession: vi.fn(),
    updatePrefs: vi.fn(),
  },
  addPlayer: vi.fn(),
  lobbyCode: { value: null as string | null },
  synced: { value: true },
  meta: new Map<string, string>(),
  players: new Map<string, string>(),
  tables: { listRows: vi.fn() },
  activityFetch: vi.fn(),
}));

vi.mock("~/utils/appwrite", () => ({
  getAppwrite: () => ({ account: activityState.account, tables: activityState.tables }),
}));

vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: activityState.activityFetch }));

vi.mock("~/composables/useLobbyDoc", () => ({
  useLobbyDoc: () => ({
    connect: async (code: string) => { activityState.lobbyCode.value = code; },
    doc: { value: null },
    getMeta: () => activityState.meta,
    getPlayers: () => activityState.players,
    lobbyCode: activityState.lobbyCode,
    // joinLobby waits for the doc to carry server state before reading or
    // writing it. These tests exercise the post-sync path, so it starts synced.
    synced: activityState.synced,
  }),
}));

vi.mock("~/composables/useLobbyMutations", () => ({
  useLobbyMutations: () => ({ addPlayer: activityState.addPlayer }),
}));

vi.mock("~/composables/useLobbyReactive", () => ({
  // Mirrors the real shape closely enough for useLobby to compose it:
  // gameState/myHand feed the visible-card-id computed behind useCardTexts.
  useLobbyReactive: () => ({
    playerList: { value: [] },
    gameState: { value: null },
    myHand: { value: [] },
  }),
}));

vi.mock("~/composables/useYjsGameEngine", () => ({
  useYjsGameEngine: () => ({}),
}));

vi.mock("~/composables/usePlayers", () => ({
  usePlayers: () => ({ getUserAvatarUrl: () => "https://example.test/avatar.png" }),
}));

import { useLobby } from "~/composables/useLobby";

describe("useLobby Activity reconnect", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal("useDiscordSDK", () => ({ isDiscordActivity: { value: true } }));
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: { appwriteDatabaseId: "db", appwriteLobbyCollectionId: "lobby" },
    }));
    vi.clearAllMocks();
    activityState.lobbyCode.value = null;
    activityState.meta.clear();
    activityState.meta.set("status", "waiting");
    activityState.players.clear();
    activityState.tables.listRows.mockResolvedValue({ rows: [{ $id: "lobby-1", code: "ABC123" }] });
    activityState.activityFetch.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.startsWith("/api/lobby/by-code/")) {
        return { id: "lobby-1", code: "ABC123" };
      }
      if (url === "/api/lobby/join") {
        return {
          lobby: { id: "lobby-1", code: "ABC123" },
          player: { id: "player-1" },
        };
      }
      return null;
    });
  });

  it("rejoins an existing lobby without replacing the Activity identity with an Appwrite session", async () => {
    const userStore = useUserStore();
    userStore.setActivityUser({
      id: "6ac4a08e-0000-4000-8000-000000000001",
      name: "DiscordPlayer",
      avatarUrl: "https://cdn.discordapp.com/avatars/discord-user/avatar.png",
      discordUserId: "discord-user",
    });

    await useLobby().joinLobby("ABC123", { username: "DiscordPlayer" });

    expect(activityState.account.createAnonymousSession).not.toHaveBeenCalled();
    expect(activityState.account.getSession).not.toHaveBeenCalled();
    expect(activityState.account.get).not.toHaveBeenCalled();
    expect(activityState.account.updatePrefs).not.toHaveBeenCalled();
    expect(userStore.user?.id).toBe("6ac4a08e-0000-4000-8000-000000000001");
    expect(activityState.addPlayer).toHaveBeenCalledWith(expect.objectContaining({
      userId: "6ac4a08e-0000-4000-8000-000000000001",
      provider: "discord",
    }));
  });

  it("still fetches and returns the server player row on a rejoin where the Y.Doc already has the player", async () => {
    const userStore = useUserStore();
    userStore.setActivityUser({
      id: "6ac4a08e-0000-4000-8000-000000000001",
      name: "DiscordPlayer",
      avatarUrl: "https://cdn.discordapp.com/avatars/discord-user/avatar.png",
      discordUserId: "discord-user",
    });

    // Simulate the Y.Doc already having this player locally (e.g. a
    // refresh/rejoin race where the client reconnected before the
    // pre-check in useJoinLobby.ts's isInLobby ran against the server).
    activityState.players.set(
      "6ac4a08e-0000-4000-8000-000000000001",
      JSON.stringify({ userId: "6ac4a08e-0000-4000-8000-000000000001", name: "DiscordPlayer" }),
    );

    const result = await useLobby().joinLobby("ABC123", { username: "DiscordPlayer" });

    // The Y.Doc mutation should stay gated on existingPlayer...
    expect(activityState.addPlayer).not.toHaveBeenCalled();
    // ...but the server call must still happen so `player` is populated.
    expect(activityState.activityFetch).toHaveBeenCalledWith(
      "/api/lobby/join",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.player).toEqual({ id: "player-1" });
  });

  // The Y.Doc is authoritative for gameplay, so being written into it IS being
  // in the game — with or without a Postgres row. The server call therefore has
  // to clear BEFORE the doc is touched, or a refused join (wrong lobby password)
  // walks straight past the check.
  it("does not add a refused joiner to the Y.Doc, and surfaces the refusal", async () => {
    const userStore = useUserStore();
    userStore.setActivityUser({
      id: "6ac4a08e-0000-4000-8000-000000000001",
      name: "DiscordPlayer",
      avatarUrl: null,
      discordUserId: "discord-user",
    });

    activityState.activityFetch.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.startsWith("/api/lobby/by-code/")) {
        return { id: "lobby-1", code: "ABC123", hasPassword: true };
      }
      if (url === "/api/lobby/join") {
        throw Object.assign(new Error("Incorrect lobby password"), {
          statusCode: 403,
        });
      }
      return null;
    });

    await expect(
      useLobby().joinLobby("ABC123", {
        username: "DiscordPlayer",
        password: "wrong",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(activityState.addPlayer).not.toHaveBeenCalled();
  });

  // A blip reaching the registry must stay non-fatal: the doc is what the game
  // runs on, and lobby rows get reconciled later.
  it("still seats the player when the registry call fails for a non-refusal reason", async () => {
    const userStore = useUserStore();
    userStore.setActivityUser({
      id: "6ac4a08e-0000-4000-8000-000000000001",
      name: "DiscordPlayer",
      avatarUrl: null,
      discordUserId: "discord-user",
    });

    activityState.activityFetch.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.startsWith("/api/lobby/by-code/")) {
        return { id: "lobby-1", code: "ABC123" };
      }
      if (url === "/api/lobby/join") {
        throw Object.assign(new Error("gateway timeout"), { statusCode: 504 });
      }
      return null;
    });

    const result = await useLobby().joinLobby("ABC123", {
      username: "DiscordPlayer",
    });

    expect(activityState.addPlayer).toHaveBeenCalled();
    expect(result.player).toBeNull();
  });

  // The doc's meta is empty until sync lands, so deriving playerType from it
  // defaulted a mid-game join to "player" and seated the joiner in a running
  // game — while the server had already clamped them to spectator. The server's
  // answer is the only authoritative one.
  it("seats a mid-game joiner as the spectator the server clamped them to", async () => {
    const userStore = useUserStore();
    userStore.setActivityUser({
      id: "6ac4a08e-0000-4000-8000-000000000001",
      name: "DiscordPlayer",
      avatarUrl: null,
      discordUserId: "discord-user",
    });

    // Exactly the race: doc meta has not arrived, so it looks like "waiting".
    activityState.meta.clear();

    activityState.activityFetch.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.startsWith("/api/lobby/by-code/")) {
        return { id: "lobby-1", code: "ABC123" };
      }
      if (url === "/api/lobby/join") {
        return {
          lobby: { id: "lobby-1", code: "ABC123" },
          player: { id: "player-1", playerType: "spectator" },
        };
      }
      return null;
    });

    await useLobby().joinLobby("ABC123", { username: "DiscordPlayer" });

    expect(activityState.addPlayer).toHaveBeenCalledWith(
      expect.objectContaining({ playerType: "spectator" }),
    );
  });
});
