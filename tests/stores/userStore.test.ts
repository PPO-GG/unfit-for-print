import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useUserStore } from "~/stores/userStore";

describe("userStore Activity identity", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("keeps the bearer-authenticated Activity user available without Appwrite", () => {
    const userStore = useUserStore();

    userStore.setActivityUser({
      id: "6ac4a08e-0000-4000-8000-000000000001",
      name: "DiscordPlayer",
      avatarUrl: "https://cdn.discordapp.com/avatars/discord-user/avatar.png",
      discordUserId: "discord-user",
    });

    expect(userStore.isLoggedIn).toBe(true);
    expect(userStore.isActivitySession).toBe(true);
    expect(userStore.user).toMatchObject({
      id: "6ac4a08e-0000-4000-8000-000000000001",
      name: "DiscordPlayer",
      discordUserId: "discord-user",
      avatarUrl: "https://cdn.discordapp.com/avatars/discord-user/avatar.png",
      isGuest: false,
      isAdmin: false,
      activeDecoration: null,
    });
  });
});
