import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PREFS_COOKIE_MAX_AGE,
  PREFS_COOKIE_OPTIONS,
} from "~/constants/persistence";

const nuxtConfigSource = readFileSync(
  resolve(process.cwd(), "nuxt.config.ts"),
  "utf8",
);

describe("persisted preference cookie", () => {
  // Regression: the userPrefs store persists through pinia-plugin-persistedstate,
  // whose Nuxt module defaults to cookie storage. Nuxt's useCookie sets no
  // expiry unless one is given, so the cookie was a *session* cookie -- volume,
  // UI scale and TTS voice survived reloads but were wiped the moment the
  // browser closed. Verified in-browser: cookieStore.get("userPrefs").expires
  // was null while i18n_redirected carried a one-year expiry.
  it("outlives the browser session", () => {
    expect(PREFS_COOKIE_OPTIONS.maxAge).toBe(PREFS_COOKIE_MAX_AGE);
    expect(PREFS_COOKIE_MAX_AGE).toBeGreaterThanOrEqual(60 * 60 * 24 * 180);
  });

  it("is wired into the persistedstate module options", () => {
    expect(nuxtConfigSource).toContain("piniaPluginPersistedstate");
    expect(nuxtConfigSource).toContain("PREFS_COOKIE_OPTIONS");
  });
});
