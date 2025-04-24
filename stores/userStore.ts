import {defineStore} from "pinia";
import {type Models, OAuthProvider} from "appwrite";
import type { AuthUser } from '~/types/auth'
import {useAppwrite} from "~/composables/useAppwrite";

export const useUserStore = defineStore("user", {
    state: () => ({
        user: null as AuthUser | null,
        session: null as Models.Session | null,
        accessToken: "" as string | null,
        isLoggedIn: false,
        playerDocId: '' as string,
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
            if (!account) {
                console.error('No account instance available');
                return;
            }

            const config = useRuntimeConfig();
            const redirect = config.public.baseUrl + '/auth/callback'
            const providerEnum = {
                google: OAuthProvider.Google,
                discord: OAuthProvider.Discord,
            }[provider];

            console.log(`OAuth login attempt - Provider: ${provider}`);
            console.log('Redirect URL:', redirect);

            try {
                const current = await account.getSession('current');
                if (current.provider === 'anonymous') {
                    console.log('Clearing anonymous session');
                    await account.deleteSession('current');
                }
            } catch (err) {
                console.log('No existing session to clear');
            }

            try {
                // This will redirect the user and won't actually return anything
                account.createOAuth2Session(providerEnum, redirect, redirect);
                // The function execution stops here due to the redirect
            } catch (err: any) {
                console.error(`OAuth initialization failed (${provider}):`, {
                    message: err.message,
                    stack: err.stack,
                    type: err.constructor.name
                });
                throw err;
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
