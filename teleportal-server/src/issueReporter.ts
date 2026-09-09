// src/issueReporter.ts
//
// Forwards this process's own crashes into unfit's issue-tracking pipeline,
// over the same public POST /api/issues/report endpoint the web app's own
// client reporter uses. Teleportal has no database of its own by design
// (see server.ts's header comment) — there is nowhere else for a crash
// report to go but out over HTTP.
//
// Every property here matters exactly as it did for the client reporter
// (app/composables/useIssueReporter.ts): this function must never throw and
// must never be awaited by its caller, because it is called from inside
// uncaughtException/unhandledRejection handlers — a process already in a
// bad state must not be made worse by its own crash reporter hanging or
// throwing on top of the original crash.

const WEB_APP_URL = process.env.WEB_APP_URL || "https://unfit.cards";
const REPORT_TIMEOUT_MS = 3000;

/**
 * Fire-and-forget by design — callers must not await this. A hung or failed
 * network call must never delay anything the caller does next.
 */
export function reportTeleportalError(message: string, stack?: string): void {
  fetch(`${WEB_APP_URL}/api/issues/report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "server-error",
      message,
      stack,
      platform: "teleportal",
    }),
    signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
  }).catch(() => {
    // Deliberately silent. The caller already logs this error to stdout via
    // console.error; a failed report must not add a second, noisier failure
    // on top of the one already being handled.
  });
}
