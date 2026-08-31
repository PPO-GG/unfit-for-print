// server/plugins/lobby-sweeper.ts
// Automated background sweeper for stale/orphaned lobbies.
// Runs every 30 minutes in server runtime.

import { pruneStaleLobbies } from "~~/server/utils/pruneLobbies";

const SWEEPER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const INITIAL_DELAY_MS = 30 * 1000; // 30 seconds after startup

export default defineNitroPlugin((nitroApp) => {
  // Never run automated background timers during unit/integration tests
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return;
  }

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let initialTimerId: ReturnType<typeof setTimeout> | null = null;

  const runSweep = async () => {
    try {
      const result = await pruneStaleLobbies();
      if (result.prunedCount > 0) {
        console.log(
          `[LobbySweeper] Pruned ${result.prunedCount} stale lobbies (${result.orphanedCount} orphaned >2h, ${result.completedCount} completed >24h)`,
        );
      }
    } catch (err: any) {
      console.warn("[LobbySweeper] Periodic sweep failed:", err?.message || err);
    }
  };

  // Run initial sweep shortly after boot
  initialTimerId = setTimeout(() => {
    runSweep();
    intervalId = setInterval(runSweep, SWEEPER_INTERVAL_MS);
  }, INITIAL_DELAY_MS);

  // Clean teardown when Nitro closes
  nitroApp.hooks.hook("close", () => {
    if (initialTimerId) clearTimeout(initialTimerId);
    if (intervalId) clearInterval(intervalId);
  });
});
