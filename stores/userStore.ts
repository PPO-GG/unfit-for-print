// stores/userStore.ts
import { defineStore } from "pinia";
import { type Models, OAuthProvider } from "appwrite";
import { useAppwrite } from "~/composables/useAppwrite";

export const useUserStore = defineStore("user", {
  state: () => ({
    user: null as Models.User<Models.Preferences> | null,
    session: null as Models.Session | null,
    accessToken: "" as string | null,
    isLoggedIn: false,
  }),
  actions: {
    async loginWithDiscord() {
      const config = useRuntimeConfig();
      const { account } = useAppwrite();

      try {
        account.createOAuth2Session(
          OAuthProvider.Discord,
          config.public.oAuthRedirectUrl,
          config.public.oAuthFailUrl
        );
        // This will redirect, so code after here won’t run until return
      } catch (error) {
        console.error("Error logging in with Discord:", error);
      }
    },

    async fetchUserSession() {
      let account;
      try {
        account = useAppwrite().account;
      } catch {
        console.error("Appwrite not available in current context");
        return;
      }

      try {
        const session = await account.getSession("current");
        this.session = session;
        this.accessToken = session.providerAccessToken ?? null;
        this.isLoggedIn = session.provider !== "anonymous";

        const user = await account.get();
        this.user = user;

        // Only fetch Discord info if logged in via Discord
        if (this.isLoggedIn && this.accessToken) {
          const discordData = await this.fetchDiscordUserData(this.accessToken);
          this.user.prefs.avatar = discordData.avatar;
          this.user.prefs.discordUserId = discordData.id;
        }
      } catch (error) {
        console.error("Error fetching session:", error);
        this.isLoggedIn = false;
        this.user = null;
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
      const { account } = useAppwrite();
      try {
        await account.deleteSessions();
        this.user = null;
        this.session = null;
        this.accessToken = "";
        this.isLoggedIn = false;
      } catch (error) {
        console.error("Error logging out:", error);
      }
    },

    async refreshSession() {
      if (
        this.session?.providerAccessTokenExpiry &&
        Date.now() / 1000 > Number(this.session.providerAccessTokenExpiry)
      ) {
        const { account } = useAppwrite();

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
      const { account } = useAppwrite();

      try {
        const session = await account.createAnonymousSession();
        const user = await account.get();

        // Save name in preferences
        await account.updatePrefs({ username });

        this.user = { ...user, name: username };
        this.session = session;
        this.isLoggedIn = true;
      } catch (err) {
        console.error("Anonymous login failed:", err);
      }
    },
  },
});
