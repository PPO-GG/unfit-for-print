// https://nuxt.com/docs/api/configuration/nuxt-config
// noinspection JSUnusedGlobalSymbols

export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  vite: {
    server: {
      hmr: {
        host: 'ufp.ppo.gg'
      }
    }
  },
  ssr: true,
  plugins: [
    { src: "~/plugins/appwrite.client.ts", mode: "client" },
    { src: "~/plugins/init-session.client.ts", mode: "client" },
  ],
  runtimeConfig: {
    appwriteApiKey: process.env.APPWRITE_API_KEY,
    public: {
      appwriteUrl: process.env.NUXT_PUBLIC_APPWRITE_URL,
      appwriteProjectId: process.env.NUXT_PUBLIC_APPWRITE_PROJECT_ID,
      appwriteDatabaseId: process.env.NUXT_PUBLIC_APPWRITE_DATABASE,
      appwriteWhiteCardCollectionId: process.env.NUXT_PUBLIC_APPWRITE_WHITE_CARD_COLLECTION_ID,
      appwriteBlackCardCollectionId: process.env.NUXT_PUBLIC_APPWRITE_BLACK_CARD_COLLECTION_ID,
      baseUrl: process.env.NUXT_PUBLIC_BASE_URL,
      oAuthRedirectUrl: process.env.NUXT_PUBLIC_OAUTH_REDIRECT_URL,
      oAuthFailUrl: process.env.NUXT_PUBLIC_OAUTH_FAIL_URL,
    },
  },
  css: ["~/assets/css/main.css"],
  modules: [
    "@nuxt/fonts",
    "@nuxt/icon",
    "@pinia/nuxt",
    "@vueuse/sound/nuxt",
    "@vueuse/nuxt",
    "@nuxt/ui",
  ],
  sound: {
    sounds: {
      scan: true,
    },
  },
})