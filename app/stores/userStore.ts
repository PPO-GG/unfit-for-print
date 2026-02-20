import { defineStore } from "pinia";
import type { Models } from "appwrite";
import type { AuthUser } from "~/types/auth";

export const useUserStore = defineStore("user", {
  state: () => ({
    user: null as AuthUser | null,
    session: null as Models.Session | null,
    accessToken: "" as string | null,
    isLoggedIn: false,
    playerDocId: "" as string,
  }),

  actions: {
    getAccount() {
      if (import.meta.server) return null;

      try {
        const { account } = useAppwrite();
        return account;
      } catch (err) {
        console.warn("useAppwrite() failed in getAccount()", err);
        return null;
      }
    },

    getClient() {
      if (import.meta.server) return null;

      try {
        const { client } = useAppwrite();
        return client;
      } catch (err) {
        console.warn("useAppwrite() failed in getClient()", err);
        return null;
      }
    },

    /**
     * Initiate Discord OAuth login.
     * Navigates to our server-side handler which uses createOAuth2Token
     * to avoid cross-origin cookie issues on localhost.
     */
    async loginWithDiscord() {
      if (import.meta.server) return;

      const account = this.getAccount();
      if (account) {
        try {
          const current = await account.getSession("current");
          if (current.provider === "anonymous") {
            await account.deleteSession("current");
          }
        } catch {
          // No existing session to clear
        }
      }

      // Navigate to the server-side OAuth initiation route
      await navigateTo("/api/auth/discord", { external: true });
    },

    async fetchUserSession() {
      if (import.meta.server) return;

      const account = this.getAccount();
      if (!account) {
        console.error("No account instance available");
        return;
      }

      try {
        const session = await account.getSession("current");
        this.session = JSON.parse(JSON.stringify(session));
        this.accessToken = session.providerAccessToken ?? null;
        this.isLoggedIn = isAuthenticatedSession(session);
        const rawUser = await account.get();
        this.user = {
          ...JSON.parse(JSON.stringify(rawUser)),
          provider: session.provider,
        };
        if (this.accessToken) {
          if (session.provider === "discord") {
            const discord = await this.fetchDiscordUserData(this.accessToken);
            this.user!.prefs.avatar = discord.avatar;
            this.user!.prefs.discordUserId = discord.id;
          }
        }
      } catch (error) {
        console.error("Error fetching session:", error);
        this.isLoggedIn = false;
        this.user = null;
        this.session = null;
      }
    },

    async fetchDiscordUserData(accessToken: string) {
      const response = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch Discord user data");
      }

      return response.json();
    },

    async logout() {
      if (import.meta.server) return;

      const account = this.getAccount();
      if (!account) return;

      try {
        await account.deleteSessions();
        this.user = null;
        this.session = null;
        this.accessToken = "";
        this.isLoggedIn = false;

        const router = useRouter();
        await router.push("/");
      } catch (error) {
        console.error("Error logging out:", error);
      }
    },

    async refreshSession() {
      if (import.meta.server) return;
      const account = this.getAccount();
      if (!account || !this.session) return;

      const expiry = Number(this.session.providerAccessTokenExpiry);
      if (expiry && Date.now() / 1000 > expiry) {
        try {
          await account.updateSession(this.session.$id);
          await this.fetchUserSession();
        } catch (error) {
          console.error("Error refreshing session:", error);
          await this.logout();
        }
      }
    },

    async createAnonymousSession(username: string) {
      if (import.meta.server) return;

      const account = this.getAccount();
      if (!account) return;

      try {
        const session = await account.createAnonymousSession();
        const rawUser = await account.get();
        await account.updatePrefs({ username });

        this.user = {
          ...JSON.parse(JSON.stringify(rawUser)),
          name: username,
          provider: session.provider,
        };
        this.session = JSON.parse(JSON.stringify(session));
        this.isLoggedIn = true;
      } catch (err) {
        console.error("Anonymous login failed:", err);
      }
    },
  },
});
