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

  // ─── Cloudflare Workers compatibility ──────────────────────────────
  // node-appwrite's HTTP client uses node-fetch-native-with-agent, which
  // in Node.js mode imports node:http/node:https to create HTTP agents.
  // In CF Workers the polyfills are incomplete and the `File` class from
  // the node path isn't constructable, causing:
  //   "Right-hand side of 'instanceof' is not callable"
  //
  // The library's package.json "exports" already declares a `workerd`
  // condition that maps to native Web API stubs (globalThis.fetch/File).
  // Adding "workerd" to Rollup's exportConditions tells the resolver to
  // pick that path instead of the Node.js-specific one.
  nitro: {
    externals: {
      inline: ["node-appwrite", "node-fetch-native-with-agent"],
    },
    exportConditions: ["workerd", "worker", "default"],
    // unenv-level aliases: resolve to the native Web API stubs provided
    // by node-fetch-native-with-agent for the workerd runtime.
    // This avoids the Node.js-specific code paths that use `instanceof`
    // with classes unavailable in Cloudflare Workers (workerd).
    unenv: {
      alias: {
        "node-fetch-native-with-agent": "node-fetch-native-with-agent/native",
        "node-fetch-native-with-agent/proxy":
          "node-fetch-native-with-agent/native",
        "node-fetch-native-with-agent/agent":
          "node-fetch-native-with-agent/native",
      },
    },
  },

  future: {
    compatibilityVersion: 4,
  },

  scripts: {
    registry: {
      // rybbitAnalytics: {
      //   siteId: "2",
      //   scriptInput: {
      //     src: "https://rybbit.ppo.gg/api/script.js",
      //   },
      // },
    },
  },
  routeRules: {
    "/": { prerender: true },
  },
  vite: {
    optimizeDeps: {
      include: ["json-bigint"],
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules") && id.includes("appwrite")) {
              return "vendor-appwrite";
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
    "@nuxtjs/i18n",
    "@nuxtjs/device",
    "@nuxt/scripts",

    "@vite-pwa/nuxt",
  ],

  // ─── PWA ──────────────────────────────────────────────────────────────
  pwa: {
    registerType: "autoUpdate",
    manifest: {
      name: "Unfit for Print",
      short_name: "Unfit",
      description:
        "A Cards Against Humanity-inspired party game. Create lobbies, play with friends, and cause chaos.",
      theme_color: "#0f172a",
      background_color: "#0f172a",
      display: "standalone",
      orientation: "any",
      categories: ["games", "entertainment"],
      icons: [
        {
          src: "/pwa-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/pwa-512x512.png",
          sizes: "512x512",
          type: "image/png",
        },
        {
          src: "/pwa-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    workbox: {
      // App shell caching only — no API caching since the game needs
      // a live connection for real-time multiplayer state.
      globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2,webp}"],
      navigateFallback: "/",
      navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
    },
    client: {
      installPrompt: true,
    },
  },

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
    // Server-only secrets
    appwriteApiKey: process.env.NUXT_APPWRITE_API_KEY,
    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,

    // Client-side (game-specific collection IDs)
    public: {
      appwriteEndpoint: process.env.NUXT_PUBLIC_APPWRITE_ENDPOINT,
      appwriteProjectId: process.env.NUXT_PUBLIC_APPWRITE_PROJECT_ID,
      appwriteDatabaseId: process.env.NUXT_PUBLIC_APPWRITE_DATABASE_ID,
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
        process.env.NUXT_PUBLIC_BASE_URL ||
        process.env.DEPLOY_URL ||
        "http://localhost:3000",
      appVersion: pkg.version,
    },
  },
});
