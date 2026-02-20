// https://nuxt.com/docs/api/configuration/nuxt-config
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(
  readFileSync(join(import.meta.dirname, "package.json"), "utf-8"),
);

export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  devtools: { enabled: false },
  ssr: true,

  future: {
    compatibilityVersion: 4,
  },

  scripts: {
    registry: {
      rybbitAnalytics: {
        siteId: "2",
        scriptInput: {
          src: "https://rybbit.ppo.gg/api/script.js",
        },
      },
    },
  },
  routeRules: {
    "/": { prerender: true },
  },
  vite: {
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("mespeak")) return "vendor-mespeak";
              if (id.includes("appwrite")) return "vendor-appwrite";

              // Split each dependency into its own chunk
              return id.split("node_modules/")[1]?.split("/")[0];
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
  sourcemap: process.env.NODE_ENV !== "production",

  components: [
    { path: "~/components/game", prefix: "" },
    { path: "~/components/lobby", prefix: "" },
    { path: "~/components/", prefix: "" },
  ],
  css: ["~/assets/css/main.css"],
  modules: [
    "@nuxt/fonts",
    "@nuxt/icon",
    "@pinia/nuxt",
    "@vueuse/sound/nuxt",
    "@vueuse/nuxt",
    "@nuxt/ui",
    "pinia-plugin-persistedstate/nuxt",
    "nuxt-og-image",
    "@nuxtjs/i18n",
    "@nuxtjs/device",
    "@nuxt/scripts",
    "nuxt-appwrite",
  ],

  // ─── nuxt-appwrite module config ─────────────────────────────────
  // Reads from NUXT_PUBLIC_APPWRITE_* and NUXT_APPWRITE_* env vars automatically.
  // Explicit values here serve as fallback defaults.
  appwrite: {},

  sound: {
    sounds: {
      scan: true,
    },
  },
  i18n: {
    defaultLocale: "en",
    locales: [
      { code: "en", name: "English", file: "en.json" },
      { code: "de", name: "Deutsch", file: "de.json" },
      { code: "es", name: "Español", file: "es.json" },
      { code: "fr", name: "Français", file: "fr.json" },
      { code: "pt", name: "Português", file: "pt.json" },
      { code: "ru", name: "Русский", file: "ru.json" },
      { code: "ja", name: "日本語", file: "ja.json" },
      { code: "ko", name: "한국인", file: "ko.json" },
      { code: "zh", name: "中文", file: "zh.json" },
    ],
    strategy: "no_prefix",
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "i18n_redirected",
      redirectOn: "root",
    },
    skipSettingLocaleOnNavigate: false,
  },
  runtimeConfig: {
    // Server-only
    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,

    // Client-side (game-specific collection IDs)
    public: {
      appwriteDatabaseId: process.env.NUXT_PUBLIC_APPWRITE_DATABASE_ID,
      appwriteAdminTeamId: process.env.NUXT_PUBLIC_APPWRITE_ADMIN_TEAM_ID,
      appwriteWhiteCardCollectionId:
        process.env.NUXT_PUBLIC_APPWRITE_WHITE_CARD_COLLECTION_ID,
      appwriteBlackCardCollectionId:
        process.env.NUXT_PUBLIC_APPWRITE_BLACK_CARD_COLLECTION_ID,
      appwriteLobbyCollectionId:
        process.env.NUXT_PUBLIC_APPWRITE_LOBBY_COLLECTION_ID,
      appwritePlayerCollectionId:
        process.env.NUXT_PUBLIC_APPWRITE_PLAYER_COLLECTION_ID,
      appwriteGamecardsCollectionId:
        process.env.NUXT_PUBLIC_APPWRITE_GAMECARDS_COLLECTION_ID,
      appwriteGamechatCollectionId:
        process.env.NUXT_PUBLIC_APPWRITE_GAMECHAT_COLLECTION_ID,
      appwriteGameSettingsCollectionId:
        process.env.NUXT_PUBLIC_APPWRITE_GAMESETTINGS_COLLECTION_ID,
      appwriteSubmissionCollectionId:
        process.env.NUXT_PUBLIC_APPWRITE_SUBMISSION_COLLECTION_ID,
      appwriteReportsCollectionId:
        process.env.NUXT_PUBLIC_APPWRITE_REPORTS_COLLECTION_ID,
      baseUrl:
        process.env.DEPLOY_URL ||
        process.env.NUXT_PUBLIC_BASE_URL ||
        "http://localhost:3000",
      appVersion: pkg.version,
    },
  },
});
