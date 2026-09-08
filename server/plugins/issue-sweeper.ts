// server/plugins/issue-sweeper.ts
// Ages out issue events and long-closed groups. Mirrors lobby-sweeper.ts,
// including its refusal to run under tests.

import { pruneIssues } from "~~/server/utils/pruneIssues";

const SWEEPER_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const INITIAL_DELAY_MS = 60 * 1000; // 1 minute after startup

export default defineNitroPlugin((nitroApp) => {
  // Never run automated background timers during unit/integration tests
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return;
  }

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let initialTimerId: ReturnType<typeof setTimeout> | null = null;

  const runSweep = async () => {
    try {
      const result = await pruneIssues();
      if (result.eventsDeleted > 0 || result.groupsDeleted > 0) {
        console.log(
          `[IssueSweeper] Pruned ${result.eventsDeleted} event(s) and ${result.groupsDeleted} resolved group(s)`,
        );
      }
    } catch (err: any) {
      console.warn("[IssueSweeper] Periodic sweep failed:", err?.message || err);
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
