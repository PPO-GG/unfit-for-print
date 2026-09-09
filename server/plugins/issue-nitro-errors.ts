// server/plugins/issue-nitro-errors.ts
//
// Wires Nitro's "error" hook to captureNitroError. Deliberately thin — all
// real logic lives in server/utils/issueNitroErrors.ts, which is unit
// tested without needing a running Nitro instance. Unlike lobby-sweeper.ts
// and issue-sweeper.ts, this plugin needs no VITEST/NODE_ENV=test guard: it
// registers an event-driven hook rather than a background timer, and under
// vitest server/api/* handlers are imported and invoked directly (see
// tests/server/setup.ts) — Nitro's plugin system, and therefore this file,
// never runs at all during the test suite.

import { captureNitroError } from "~~/server/utils/issueNitroErrors";

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("error", (error, context) => {
    // Not awaited: Nitro does not wait for this hook before sending the
    // error response (captureError's promise is fired and its own errors
    // are Nitro's problem, not the request's), and this hook must not
    // either — a slow DB write must never delay the response the caller is
    // actually waiting on.
    void captureNitroError(error, context);
  });
});
