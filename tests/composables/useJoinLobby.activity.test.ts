import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useUserStore } from "~/stores/userStore";

const activityState = vi.hoisted(() => ({
  account: {
    createAnonymousSession: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({ useRouter: () => ({}) }));
vi.mock("~/composables/useLobby", () => ({ useLobby: () => ({}) }));
vi.mock("~/composables/useProfanityFilter", () => ({
  useProfanityFilter: () => ({ isBadUsername: () => false }),
}));
vi.mock("~/utils/appwrite", () => ({
  getAppwrite: () => ({ account: activityState.account }),
}));

import { useJoinLobby } from "~/composables/useJoinLobby";

describe("useJoinLobby game-page Activity bootstrap", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.stubGlobal("useI18n", () => ({ t: (key: string) => key }));
  });

  it("keeps the bearer-derived user through the game-page session bootstrap", async () => {
    const userStore = useUserStore();
    userStore.setActivityUser({
      id: "6ac4a08e-0000-4000-8000-000000000001",
      name: "DiscordPlayer",
      avatarUrl: "https://cdn.discordapp.com/avatars/discord-user/avatar.png",
      discordUserId: "discord-user",
    });
    const activityUserId = userStore.user?.$id;

    await useJoinLobby().initializeGamePageSession();

    expect(userStore.user?.$id).toBe(activityUserId);
    expect(userStore.isActivitySession).toBe(true);
    expect(activityState.account.createAnonymousSession).not.toHaveBeenCalled();
  });
});
