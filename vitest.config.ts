import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

// Plain vitest, unlike `nuxt dev`, does not read .env — so without this
// TEST_DATABASE_URL had to be passed inline on every run. Loading it here also
// makes the guardrail in tests/server/setup.ts stronger, not weaker: it can now
// see the real DATABASE_URL and refuse to run when the two point at the same
// database. Existing shell variables still win (dotenv never overwrites).
loadEnv();

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".nuxt", ".output"],
    setupFiles: ["tests/server/setup.ts"],
  },
  resolve: {
    alias: {
      "#shared": fileURLToPath(new URL("./shared", import.meta.url)),
      "~~/server": fileURLToPath(new URL("./server", import.meta.url)),
      "~/server": fileURLToPath(new URL("./server", import.meta.url)),
      "~": fileURLToPath(new URL("./app/", import.meta.url)),
      "@": fileURLToPath(new URL("./app/", import.meta.url)),
      // Add these aliases for Nuxt compatibility
      "#app": fileURLToPath(
        new URL("./node_modules/nuxt/dist/app", import.meta.url),
      ),
      "#imports": fileURLToPath(
        new URL("./node_modules/nuxt/dist/app/imports", import.meta.url),
      ),
      "#build": fileURLToPath(new URL("./.nuxt", import.meta.url)),
    },
  },
});
