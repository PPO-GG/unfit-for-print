import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";

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
