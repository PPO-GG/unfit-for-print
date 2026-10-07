import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        // The workerd bundled with pool-workers 0.22 trails wrangler and
        // rejects the newer date in wrangler.jsonc.
        compatibilityDate: "2026-08-22",
        // The issue reporter posts to WEB_APP_URL; answer it locally so a
        // failing lookup does not surface as an uncaught exception.
        outboundService: () => new Response("{}", { status: 200 }),
        bindings: {
          SYNC_ADMIN_TOKEN: "test-admin-token",
          WEB_APP_URL: "http://web.test",
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
    // Saves are debounced 2 s; persistence tests wait on them.
    testTimeout: 20_000,
  },
});
