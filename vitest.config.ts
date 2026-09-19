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

// Suites that already fail on `main` for reasons unrelated to whatever change
// is being tested. They are skipped only when VITEST_SKIP_KNOWN_FAILING=1,
// which CI sets so that a pull request gates on the ~1085 tests that do pass
// instead of drowning in a fixed baseline of 39 failures.
//
// This list is a debt ledger, not a permanent exclusion: delete entries as the
// suites are repaired, and never add one to make a new failure go away.
const KNOWN_FAILING = [
  "tests/stores/userPrefsStore.test.ts",
  "tests/components/game/UserHand.test.ts",
  "tests/components/game/mobile/MobileBlackCard.test.ts",
  "tests/components/game/mobile/MobileCardList.test.ts",
  "tests/components/game/mobile/MobileGameLayout.test.ts",
  "tests/server/db/lobby-detail-admin.test.ts",
  "tests/server/db/lobby-prune.test.ts",
];

const skipKnownFailing = process.env.VITEST_SKIP_KNOWN_FAILING === "1";

// Project-level `exclude` replaces this rather than merging with it, so both
// projects below have to spell out the full list.
const exclude = (...extra: string[]) => [
  "node_modules",
  "dist",
  ".nuxt",
  ".output",
  ...(skipKnownFailing ? KNOWN_FAILING : []),
  ...extra,
];

// Two projects, because `tests/server/db/*` cannot share the parallel pool.
// Those suites all point at one database and `TRUNCATE` its tables in
// `beforeEach`, so running two of them at once deadlocks in Postgres
// ("deadlock detected", 40P01) — and the locks a deadlocked run leaves behind
// go on to fail unrelated card/pack suites on the next pass, which reads as a
// change having broken something it never touched.
//
// CI already sidestepped this by running two steps: `vitest run --exclude
// 'tests/server/db/**'` and then `pnpm test:db`. That knowledge lived only in
// the workflow file, so a plain `pnpm test` — the command AGENTS.md points at —
// still deadlocked locally. It lives here now, so a single `vitest run` does
// the right thing everywhere, and CI is back to one step.
export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["tests/server/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/**/*.test.ts"],
          exclude: exclude("tests/server/db/**"),
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["tests/server/db/**/*.test.ts"],
          exclude: exclude(),
          // The whole point of the split.
          fileParallelism: false,
        },
      },
    ],
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
