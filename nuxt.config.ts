// https://nuxt.com/docs/api/configuration/nuxt-config
import { visualizer } from 'rollup-plugin-visualizer'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'))

export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  ssr: true,
  vite: {
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('mespeak')) return 'vendor-mespeak'
              if (id.includes('appwrite')) return 'vendor-appwrite'
              return 'vendor'
            }
          }
        },
        plugins: [
          visualizer({ open: true, filename: 'dist/stats.html' })
        ]
      }
    },
    define: {
      __VERSION__: JSON.stringify(pkg.version),
    },
  },
  plugins: [
    { src: "~/plugins/appwrite.client.ts", mode: "client" },
    { src: "~/plugins/init-session.client.ts", mode: "client" },
  ],
  components: [
    { path: '~/components/game', prefix: '' },
    { path: '~/components/lobby', prefix: '' },
    { path: '~/components/', prefix: '' },
  ],
  runtimeConfig: {
    appwriteApiKey: process.env.APPWRITE_API_KEY,
    appwriteEndpoint: process.env.APPWRITE_ENDPOINT,
    appwriteProjectId: process.env.APPWRITE_PROJECT_ID,
    appwriteDbId: process.env.APPWRITE_DB_ID,
    appwriteLobbyCollectionId: process.env.APPWRITE_LOBBY_COLLECTION_ID,
    appwriteGamecardsCollectionId: process.env.APPWRITE_GAMECARDS_COLLECTION_ID,
    appwriteAdminTeamId: process.env.APPWRITE_ADMIN_TEAM_ID,

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
      appwriteAdminTeamId: process.env.NUXT_PUBLIC_APPWRITE_ADMIN_TEAM_ID,
      appwriteFunctionsStartGame: process.env.NUXT_PUBLIC_APPWRITE_FUNCTIONS_START_GAME,
      appwriteFunctionsPlayCard: process.env.NUXT_PUBLIC_APPWRITE_FUNCTIONS_PLAY_CARD,
      appwriteFunctionsSelectWinner: process.env.NUXT_PUBLIC_APPWRITE_FUNCTIONS_SELECT_WINNER,
      appwriteFunctionsStartNextRound: process.env.NUXT_PUBLIC_APPWRITE_FUNCTIONS_START_NEXT_ROUND,
      baseUrl: process.env.NUXT_PUBLIC_BASE_URL,
      oAuthRedirectUrl: process.env.NUXT_PUBLIC_OAUTH_REDIRECT_URL,
      oAuthFailUrl: process.env.NUXT_PUBLIC_OAUTH_FAIL_URL,
      appVersion: pkg.version,
    }
  },
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
  ],
  sound: {
    sounds: {
      scan: true,
    },
  },
})