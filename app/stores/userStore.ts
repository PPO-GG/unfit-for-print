import { defineStore } from "pinia";
import type { AuthUser } from "~/types/auth";

export const useUserStore = defineStore("user", {
  state: () => ({
    user: null as AuthUser | null,
    isLoggedIn: false,
    isActivitySession: false,
    playerDocId: "" as string,
  }),

  actions: {
    /**
     * Used by the Discord Activity (embedded iframe) login flow, which
     * authenticates via a signed activity token rather than a browser
     * session cookie — see useDiscordSDK.ts.
     */
    setActivityUser(activityUser: {
      id: string;
      name: string;
      avatarUrl: string | null;
      discordUserId: string;
    }) {
      this.user = {
        id: activityUser.id,
        name: activityUser.name,
        avatarUrl: activityUser.avatarUrl,
        discordUserId: activityUser.discordUserId,
        isGuest: false,
        isAdmin: false,
        activeDecoration: null,
      };
      this.isLoggedIn = true;
      this.isActivitySession = true;
    },

    async fetchSession() {
      const { user } = await $fetch("/api/auth/session");
      this.user = user as AuthUser | null;
      this.isLoggedIn = !!user;
    },

    loginWithDiscord() {
      if (import.meta.server) return;
      return navigateTo("/api/auth/discord", { external: true });
    },

    async loginAsGuest(username: string) {
      const { user } = await $fetch("/api/auth/guest", {
        method: "POST",
        body: { username },
      });
      this.user = user as AuthUser;
      this.isLoggedIn = true;
    },

    async logout() {
      await $fetch("/api/auth/logout", { method: "POST" });
      this.user = null;
      this.isLoggedIn = false;
      this.isActivitySession = false;
      this.playerDocId = "";
      if (import.meta.client) {
        await navigateTo("/");
      }
    },
  },
});
