/**
 * Storage options for the persisted `userPrefs` Pinia store.
 *
 * `pinia-plugin-persistedstate`'s Nuxt module stores state in a **cookie** by
 * default -- not localStorage -- and Nuxt's `useCookie` writes no expiry unless
 * one is supplied. That made `userPrefs` a session cookie: volume, UI scale,
 * TTS voice and the profanity filter survived reloads but were wiped the moment
 * the browser closed, while theme (localStorage, via `nuxt-color-mode`) and
 * language (`i18n_redirected`, one-year expiry) kept sticking -- which is why
 * only *some* settings looked like they weren't saving.
 *
 * `maxAge` is in seconds. Keep it here rather than inline in `nuxt.config.ts`
 * so the invariant is unit-testable.
 */
export const PREFS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year

export const PREFS_COOKIE_OPTIONS = {
  maxAge: PREFS_COOKIE_MAX_AGE,
  path: "/",
  sameSite: "lax",
} as const;
