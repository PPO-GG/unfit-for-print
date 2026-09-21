import { defineStore } from "pinia";
import type { AuthUser } from "~/types/auth";

export const useUserStore = defineStore("user", {
  state: () => ({
    user: null as AuthUser | null,
    isLoggedIn: false,
    isActivitySession: false,
    playerDocId: "" as string,
    /**
     * False until the session has actually been resolved one way or the other.
     * The session is fetched client-side and asynchronously
     * (plugins/init-session.client.ts), so `user === null` means "logged out"
     * and "not asked yet" alike. Server-rendered UI that gates on auth needs to
     * tell those apart, or it asserts "logged out" at a returning user for the
     * half-second before their session lands.
     */
    sessionReady: false,
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
      activeDecoration?: string | null;
    }) {
      this.user = {
        id: activityUser.id,
        name: activityUser.name,
        avatarUrl: activityUser.avatarUrl,
        discordUserId: activityUser.discordUserId,
        isGuest: false,
        isAdmin: false,
        activeDecoration: activityUser.activeDecoration ?? null,
      };
      this.isLoggedIn = true;
      this.isActivitySession = true;
      this.sessionReady = true;
    },

    async fetchSession() {
      try {
        const { user } = await $fetch("/api/auth/session");
        this.user = user as AuthUser | null;
        this.isLoggedIn = !!user;
      } finally {
        // Set even on failure: a session we could not fetch is still a session
        // we are done waiting on, and leaving this false parks the UI in its
        // indeterminate state forever.
        this.sessionReady = true;
      }
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
      this.sessionReady = true;
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
