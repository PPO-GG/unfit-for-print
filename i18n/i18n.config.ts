// vue-i18n runtime options. @nuxtjs/i18n v9+ picks this file up automatically;
// locale *messages* still come from the `locales[].file` entries in nuxt.config.
export default defineI18nConfig(() => ({
  // vue-i18n defaults fallbackLocale to false, which renders a missing key as
  // its raw path — so a German user saw the literal string "game.read_aloud".
  // Every non-English locale is missing ~77 of the 239 keys in en.json, so that
  // was roughly 600 raw key paths on screen across the eight translations.
  // Falling back to English degrades to a readable string instead.
  fallbackLocale: "en",
  // The fallback is expected here, not a symptom of a broken build; without
  // this every fallback logs a warning in dev.
  silentFallbackWarn: true,
}));
