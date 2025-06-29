// https://nuxt.com/docs/api/configuration/nuxt-config
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'))

export default defineNuxtConfig({
    compatibilityDate: "2024-11-01",
    devtools: {enabled: false},
    ssr: true,
    scripts: {
        registry: {
            rybbitAnalytics: {
                siteId: '2',
                scriptInput: {
                    src: 'https://rybbit.ppo.gg/api/script.js'
                }
            }
        }
    },
    routeRules: {
        '/': {prerender: true}
    },
    vite: {
        build: {
            sourcemap: false,
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes('node_modules')) {
                            if (id.includes('mespeak')) return 'vendor-mespeak';
                            if (id.includes('appwrite')) return 'vendor-appwrite';

                            // Split each dependency into its own chunk
                            return id.split('node_modules/')[1].split('/')[0];
                        }
                    },
                },
            },
            chunkSizeWarningLimit: 1600,
        },
        define: {
            __VERSION__: JSON.stringify(pkg.version),
        },
    },
    sourcemap: process.env.NODE_ENV !== 'production',
    plugins: [
        {src: "~/plugins/appwrite.client.ts", mode: "client"},
        {src: "~/plugins/init-session.client.ts", mode: "client"},
        {src: "~/plugins/i18n.client.ts", mode: "client"},
        {src: "~/plugins/gsap.client.ts", mode: "client"},
    ],
    components: [
        {path: '~/components/game', prefix: ''},
        {path: '~/components/lobby', prefix: ''},
        {path: '~/components/', prefix: ''},
    ],
    css: ["~/assets/css/main.css"],
    modules: [
      "@nuxt/fonts",
      "@nuxt/icon",
      "@pinia/nuxt",
      "@vueuse/sound/nuxt",
      "@vueuse/nuxt",
      "@nuxt/ui",
      'pinia-plugin-persistedstate/nuxt',
      "nuxt-og-image",
      '@nuxtjs/i18n',
      '@nuxtjs/device',
      '@nuxt/scripts',
    ],
    sound: {
        sounds: {
            scan: true,
        },
    },
    i18n: {
        defaultLocale: 'en',
        locales: [
            {code: 'en', name: 'English', file: 'en.json'},
            {code: 'de', name: 'Deutsch', file: 'de.json'},
            {code: 'es', name: 'Español', file: 'es.json'},
            {code: 'fr', name: 'Français', file: 'fr.json'},
            {code: 'pt', name: 'Português', file: 'pt.json'},
            {code: 'ru', name: 'Русский', file: 'ru.json'},
            {code: 'ja', name: '日本語', file: 'ja.json'},
            {code: 'ko', name: '한국인', file: 'ko.json'},
            {code: 'zh', name: '中文', file: 'zh.json'},
        ],
        lazy: true,
        strategy: 'no_prefix',
        detectBrowserLanguage: {
            useCookie: true,
            cookieKey: 'i18n_redirected',
            redirectOn: 'root',
        },
        bundle: {
            optimizeTranslationDirective: false,
        },
        skipSettingLocaleOnNavigate: false,
    },
    runtimeConfig: {
        appwriteApiKey: process.env.APPWRITE_API_KEY,
        appwriteEndpoint: process.env.APPWRITE_ENDPOINT,
        appwriteProjectId: process.env.APPWRITE_PROJECT_ID,
        appwriteDbId: process.env.APPWRITE_DB_ID,
        appwriteLobbyCollectionId: process.env.APPWRITE_LOBBY_COLLECTION_ID,
        appwriteGamecardsCollectionId: process.env.APPWRITE_GAMECARDS_COLLECTION_ID,
        appwriteAdminTeamId: process.env.APPWRITE_ADMIN_TEAM_ID,
        elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,
        public: {
            appwriteUrl: process.env.NUXT_PUBLIC_APPWRITE_URL,
            appwriteProjectId: process.env.NUXT_PUBLIC_APPWRITE_PROJECT_ID,
            appwriteDatabaseId: process.env.NUXT_PUBLIC_APPWRITE_DATABASE,

            appwriteWhiteCardCollectionId: process.env.NUXT_PUBLIC_APPWRITE_WHITE_CARD_COLLECTION_ID,
            appwriteBlackCardCollectionId: process.env.NUXT_PUBLIC_APPWRITE_BLACK_CARD_COLLECTION_ID,
            appwriteLobbyCollectionId: process.env.NUXT_PUBLIC_APPWRITE_LOBBY_COLLECTION_ID,
            appwritePlayerCollectionId: process.env.NUXT_PUBLIC_APPWRITE_PLAYER_COLLECTION_ID,
            appwriteGamecardsCollectionId: process.env.NUXT_PUBLIC_APPWRITE_GAMECARDS_COLLECTION_ID,
            appwriteGamechatCollectionId: process.env.NUXT_PUBLIC_APPWRITE_GAMECHAT_COLLECTION_ID,
            appwriteGameSettingsCollectionId: process.env.NUXT_PUBLIC_APPWRITE_GAMESETTINGS_COLLECTION_ID,
            appwriteSubmissionCollectionId: process.env.NUXT_PUBLIC_APPWRITE_SUBMISSION_COLLECTION_ID,
            appwriteReportsCollectionId: process.env.NUXT_PUBLIC_APPWRITE_REPORTS_COLLECTION_ID,

            appwriteAdminTeamId: process.env.NUXT_PUBLIC_APPWRITE_ADMIN_TEAM_ID,
            appwriteFunctionsStartGame: process.env.NUXT_PUBLIC_APPWRITE_FUNCTIONS_START_GAME,
            appwriteFunctionsPlayCard: process.env.NUXT_PUBLIC_APPWRITE_FUNCTIONS_PLAY_CARD,
            appwriteFunctionsSelectWinner: process.env.NUXT_PUBLIC_APPWRITE_FUNCTIONS_SELECT_WINNER,
            appwriteFunctionsStartNextRound: process.env.NUXT_PUBLIC_APPWRITE_FUNCTIONS_START_NEXT_ROUND,
            appwriteFunctionsEndSubmissionPhase: process.env.NUXT_PUBLIC_APPWRITE_FUNCTIONS_END_SUBMISSION_PHASE,
            baseUrl: process.env.DEPLOY_URL || process.env.NUXT_PUBLIC_BASE_URL || 'http://localhost:3000',
            oAuthRedirectUrl: process.env.NUXT_PUBLIC_OAUTH_REDIRECT_URL,
            oAuthFailUrl: process.env.NUXT_PUBLIC_OAUTH_FAIL_URL,
            appVersion: pkg.version,
        }
    },
})