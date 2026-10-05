// https://nuxt.com/docs/api/configuration/nuxt-config
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PREFS_COOKIE_OPTIONS } from "./app/constants/persistence";

// Canonical origin. Also feeds runtimeConfig.public.baseUrl below. The SEO
// modules bake this in at build time (override at runtime with NUXT_SITE_URL),
// so the default must be the real origin -- docker-compose only
// provides NUXT_PUBLIC_BASE_URL at runtime, and a localhost default here would
// put localhost in every canonical, og:url and sitemap entry.
const siteUrl =
  process.env.NUXT_PUBLIC_BASE_URL ||
  process.env.DEPLOY_URL ||
  "https://unfit.cards";

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
  css: ["~/assets/css/main.css", "~/assets/css/lobby.css", "~/assets/css/decorations.css"],
  modules: [
    "@nuxt/fonts",
    "@nuxt/icon",
    "@pinia/nuxt",
    "@vueuse/nuxt",
    "@nuxt/ui",
    "pinia-plugin-persistedstate/nuxt",
    "@nuxtjs/i18n",
    "@nuxtjs/device",
    "@nuxt/scripts",
    "@vite-pwa/nuxt",
    "nuxt-auth-utils",
    "@nuxtjs/seo",
  ],

  // ─── SEO ──────────────────────────────────────────────────────────────
  // @nuxtjs/seo bundles robots, sitemap, schema.org, canonical/og:url
  // generation and site-config. Per-page canonicals now come from the route,
  // not a global useHead() (which used to point every page at the homepage).
  site: {
    url: siteUrl,
    name: "Unfit for Print",
    description:
      "Unfit for Print is a free online party card game in the style of Cards Against Humanity. Create a lobby, share the code and play with friends in your browser.",
    defaultLocale: "en",
  },

  // We ship a hand-made 1200x630 /img/og.png; runtime image generation would
  // pull satori/chromium into the Docker image for no gain.
  ogImage: { enabled: false },
  // Dev-time crawler of our own pages; noisy for an SSR app with dynamic routes.
  linkChecker: { enabled: false },

  robots: {
    // Crawl-blocked outright: nothing here is content. Lobbies (/game/**) are
    // left crawlable-but-noindex via routeRules so the noindex is actually seen.
    disallow: ["/api/", "/admin", "/auth/", "/activity"],
  },

  sitemap: {
    // Only the public marketing/doc pages. Everything else is noindex below.
    exclude: ["/game/**", "/activity/**", "/admin/**", "/auth/**", "/profile"],
  },

  // `robots: false` sets noindex (meta + X-Robots-Tag) and a robots.txt
  // Disallow for the matching routes.
  routeRules: {
    "/game": { robots: false },
    "/game/**": { robots: false },
    "/activity/**": { robots: false },
    // The hub was removed; an Activity left open across that deploy still
    // has it in its old bundle.
    "/activity/hub": { redirect: "/" },
    "/admin/**": { robots: false },
    "/auth/**": { robots: false },
    "/profile": { robots: false },
  },

  // The persistedstate module defaults to a cookie with no expiry, i.e. a
  // session cookie -- see app/constants/persistence.ts. Give it a real
  // lifetime so the userPrefs store survives closing the browser.
  piniaPluginPersistedstate: {
    cookieOptions: PREFS_COOKIE_OPTIONS,
  },

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
    elevenlabsApiKey: process.env.NUXT_ELEVENLABS_API_KEY,
    discordClientSecret: process.env.NUXT_DISCORD_CLIENT_SECRET,
    discordPublicKey: process.env.NUXT_DISCORD_PUBLIC_KEY,
    discordApplicationId: process.env.NUXT_DISCORD_APPLICATION_ID,
    sessionPassword: process.env.NUXT_SESSION_PASSWORD,
    activityTokenSecret: process.env.NUXT_ACTIVITY_TOKEN_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    r2AccountId: process.env.NUXT_R2_ACCOUNT_ID,
    r2AccessKeyId: process.env.NUXT_R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.NUXT_R2_SECRET_ACCESS_KEY,
    r2Bucket: process.env.NUXT_R2_BUCKET,

    // New guest identities allowed per IP per 10 minutes (POST /api/auth/guest
    // is unauthenticated and inserts a `users` row). 0 disables the throttle —
    // the escape hatch if the app ends up behind a proxy that hides client IPs
    // and every caller collapses into one bucket.
    guestRateLimit: Number(process.env.NUXT_GUEST_RATE_LIMIT ?? 20),

    // Private Discord channel that receives one alert per new issue group
    // (and per regression). Unset disables alerting entirely; the admin page
    // still works.
    issueWebhookUrl: process.env.NUXT_ISSUE_WEBHOOK_URL || "",

    // Issue ingest throttles. 0 disables, matching guestRateLimit's escape
    // hatch for deployments behind a proxy that hides client IPs.
    issueRateLimitIp: Number(process.env.NUXT_ISSUE_RATE_LIMIT_IP ?? 30),
    issueRateLimitLobby: Number(process.env.NUXT_ISSUE_RATE_LIMIT_LOBBY ?? 60),

    // nuxt-auth-utils session cookie config. Without maxAge, h3 issues the
    // session cookie with no Expires/Max-Age, making it a browser-session
    // cookie that's wiped on browser close instead of persisting.
    //
    // `password` is required by h3's SessionConfig type. Left empty on
    // purpose — the same default nuxt-auth-utils applies — so the real secret
    // still comes from NUXT_SESSION_PASSWORD at runtime and never gets baked
    // into the build output.
    session: {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      password: "",
      // h3 marks the session cookie Secure by default. Browsers keep Secure
      // cookies on http://localhost but drop them on plain-http LAN addresses,
      // so testing on a phone via http://<lan-ip>:3000 signed you in as a new
      // guest on every request (new id, empty hand). Production stays Secure.
      cookie: { secure: process.env.NODE_ENV === "production" },
    },

    public: {
      baseUrl: siteUrl,
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
