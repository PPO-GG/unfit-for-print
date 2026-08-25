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
  meta: new Map<string, string>(),
  players: new Map<string, string>(),
  tables: { listRows: vi.fn() },
}));

vi.mock("~/utils/appwrite", () => ({
  getAppwrite: () => ({ account: activityState.account, tables: activityState.tables }),
}));

vi.mock("~/composables/useLobbyDoc", () => ({
  useLobbyDoc: () => ({
    connect: async (code: string) => { activityState.lobbyCode.value = code; },
    doc: { value: null },
    getMeta: () => activityState.meta,
    getPlayers: () => activityState.players,
    lobbyCode: activityState.lobbyCode,
  }),
}));

vi.mock("~/composables/useLobbyMutations", () => ({
  useLobbyMutations: () => ({ addPlayer: activityState.addPlayer }),
}));

vi.mock("~/composables/useLobbyReactive", () => ({
  useLobbyReactive: () => ({ playerList: { value: [] } }),
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
    expect(userStore.user?.$id).toBe("6ac4a08e-0000-4000-8000-000000000001");
    expect(activityState.addPlayer).toHaveBeenCalledWith(expect.objectContaining({
      userId: "6ac4a08e-0000-4000-8000-000000000001",
      provider: "discord",
    }));
  });
});
