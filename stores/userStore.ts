import {defineStore} from "pinia";
import {type Models, OAuthProvider} from "appwrite";
import {useAppwrite} from "~/composables/useAppwrite";

export const useUserStore = defineStore("user", {
    state: () => ({
        user: null as Models.User<Models.Preferences> | null,
        session: null as Models.Session | null,
        accessToken: "" as string | null,
        isLoggedIn: false,
    }),

    actions: {
        getAccount() {
            if (import.meta.server) return null;

            try {
                return useAppwrite().account;
            } catch (err) {
                console.warn("useAppwrite() failed in getAccount()", err);
                return null;
            }
        },

        async loginWithProvider(provider: 'google' | 'discord') {
            if (import.meta.server) return;
            const account = this.getAccount();
            if (!account) return;

            const config  = useRuntimeConfig();
            const redirect = config.public.baseUrl
            const providerEnum = {
                google:  OAuthProvider.Google,
                discord: OAuthProvider.Discord,
            }[provider];

            // 1️⃣ If we’re currently an anonymous session, clear it
            try {
                const current = await account.getSession('current');
                if (current.provider === 'anonymous') {
                    await account.deleteSession('current');
                }
            } catch {
                // no session to delete — ignore
            }

            // 2️⃣ Kick off the real OAuth flow
            try {
                console.log(`🔐 OAuth login with ${provider}`);
                console.log('⚙️ runtimeConfig.public:', config.public)
                console.log('⚙️ computed redirect URL:', redirect)
                await account.createOAuth2Session(providerEnum, redirect, redirect);
            } catch (err: any) {
                console.error(`❌ OAuth login (${provider}) failed:`, err.message || err);

            }
        },

        async fetchUserSession() {
            if (import.meta.server) return;

            const account = this.getAccount();
            if (!account) return;

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

                // 🧠 Fetch external profile data
                if (this.accessToken) {
                    if (session.provider === 'discord') {
                        const discord = await this.fetchDiscordUserData(this.accessToken);
                        this.user!.prefs.avatar = discord.avatar;
                        this.user!.prefs.discordUserId = discord.id;
                    } else if (session.provider === 'google') {
                        const google = await this.fetchGoogleUserData(this.accessToken);
                        this.user!.prefs.avatar = google.picture;
                        this.user!.prefs.name = google.name;
                        this.user!.prefs.email = google.email;
                    }
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

        async fetchGoogleUserData(accessToken: string) {
            const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (!res.ok) throw new Error("Failed to fetch Google profile");
            return res.json();
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
                    provider: session.provider, // ✅ attach provider here too
                };
                this.session = JSON.parse(JSON.stringify(session));
                this.isLoggedIn = true;
            } catch (err) {
                console.error("Anonymous login failed:", err);
            }
        },
    },
});
