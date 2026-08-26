// https://nuxt.com/docs/api/configuration/nuxt-config
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(
  readFileSync(join(import.meta.dirname, "package.json"), "utf-8"),
);

export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  devtools: { enabled: true },
  ssr: true,

  nitro: {
    preset: "node-server",
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
    { path: "~/components/decorations", prefix: "" },
    { path: "~/components/", prefix: "" },
  ],
  css: ["~/assets/css/main.css", "~/assets/css/lobby.css"],
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
    "@nuxtjs/mdc",
    "nuxt-auth-utils",
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
      // Static-asset caching only. navigateFallback is intentionally omitted:
      // this is an SSR app — the server handles all routes. HTML is excluded
      // from globPatterns so the SW never serves stale markup for navigations.
      globPatterns: ["**/*.{js,css,png,svg,ico,woff2,webp}"],
      cleanupOutdatedCaches: true,
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
    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,
    discordClientSecret: process.env.DISCORD_CLIENT_SECRET,
    discordPublicKey: process.env.DISCORD_PUBLIC_KEY,
    discordApplicationId: process.env.DISCORD_APPLICATION_ID,
    sessionPassword: process.env.NUXT_SESSION_PASSWORD,
    activityTokenSecret: process.env.NUXT_ACTIVITY_TOKEN_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    r2AccountId: process.env.NUXT_R2_ACCOUNT_ID,
    r2AccessKeyId: process.env.NUXT_R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.NUXT_R2_SECRET_ACCESS_KEY,
    r2Bucket: process.env.NUXT_R2_BUCKET,

    public: {
      baseUrl:
        process.env.NUXT_PUBLIC_BASE_URL ||
        process.env.DEPLOY_URL ||
        "http://localhost:3000",
      appVersion: pkg.version,

      // Yjs lobby Teleportal server
      lobbyTeleportalUrl:
        process.env.NUXT_PUBLIC_LOBBY_TELEPORTAL_URL ||
        "wss://teleportal.unfit.cards",

      // Discord Activity
      discordClientId: process.env.NUXT_PUBLIC_DISCORD_CLIENT_ID || "",
    },
  },
});
