// server/utils/issueNitroErrors.ts
//
// Captures 5xx errors thrown by server/api/* directly into the issue
// pipeline, in-process — no HTTP round trip to POST /api/issues/report,
// since that route lives in the same process that would be reporting on
// itself. Reuses normalizeIssuePayload/recordIssue/notifyIssue exactly as
// the HTTP route does, so truncation, fingerprinting, grouping, and Discord
// alerting all come for free; see server/api/issues/report.post.ts.
//
// Registered on Nitro's "error" hook by server/plugins/issue-nitro-errors.ts,
// which is thin wiring — all real logic lives here so it is unit-testable
// without a running Nitro instance. Every path in captureNitroError is
// wrapped: this hook runs inside Nitro's own error-handling chain, and a
// throw from an error handler is the one place recursion becomes a real
// risk rather than a theoretical one.

import type { H3Event } from "h3";
import { normalizeIssuePayload } from "./issueIngest";
import { recordIssue, type RecordIssueResult } from "./issueStore";
import { notifyIssue } from "./issueWebhook";

/**
 * Only genuine server failures get captured — 4xx is expected validation
 * traffic, not a bug. `/api/issues/*` is excluded outright at any status: an
 * error thrown while recording an issue must never try to record itself,
 * the one failure mode this pipeline cannot survive.
 */
export function shouldCaptureNitroError(
  statusCode: number,
  path: string | undefined,
): boolean {
  if (statusCode < 500) return false;
  if (!path) return false;
  if (path.startsWith("/api/issues/")) return false;
  return true;
}

/** A bare `throw new Error(...)` (as opposed to `createError(...)`) carries
 *  no statusCode at all. Nitro's own default error handler treats that as
 *  500, and so do we — an uncaught exception is, if anything, the more
 *  important half of "server error" to catch. */
function resolveStatusCode(error: unknown): number {
  const withStatus = error as { statusCode?: unknown; status?: unknown };
  const raw = withStatus?.statusCode ?? withStatus?.status;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 500;
}

export interface NitroErrorReport {
  kind: "api-error";
  message: string;
  stack?: string;
  route: string;
  platform: "server";
  appVersion?: string;
  context: { method: string; statusCode: number };
}

/**
 * Pure: no Nitro globals, no DB. Takes just the two H3Event fields it
 * actually needs, so it is constructible from a plain object in tests.
 */
export function buildNitroErrorReport(
  error: unknown,
  event: Pick<H3Event, "path" | "method">,
  appVersion?: string,
): NitroErrorReport {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    kind: "api-error",
    message: err.message || "Server Error",
    stack: err.stack,
    route: event.path,
    platform: "server",
    appVersion,
    context: { method: event.method, statusCode: resolveStatusCode(error) },
  };
}

/** The shape Nitro actually calls the "error" hook with — confirmed against
 *  the installed @nuxt/nitro-server source: `captureError(error, { event,
 *  tags })`, where `event` is absent for errors with no request context
 *  (e.g. a plugin failing to load) rather than typed as always present. */
export interface NitroErrorContext {
  event?: H3Event;
  tags?: string[];
}

export async function captureNitroError(
  error: unknown,
  context: NitroErrorContext,
  deps: {
    record?: (...args: Parameters<typeof recordIssue>) => Promise<RecordIssueResult>;
    notify?: (...args: Parameters<typeof notifyIssue>) => Promise<void>;
  } = {},
): Promise<void> {
  const record = deps.record ?? recordIssue;
  const notify = deps.notify ?? notifyIssue;

  try {
    const event = context.event;
    if (!event) return;

    const statusCode = resolveStatusCode(error);
    if (!shouldCaptureNitroError(statusCode, event.path)) return;

    const appVersion = useRuntimeConfig(event).public.appVersion as
      | string
      | undefined;
    const report = buildNitroErrorReport(error, event, appVersion);

    const normalized = normalizeIssuePayload(report);
    if (!normalized.ok) return;

    const result = await record(normalized.value, { userId: null });

    if (result.shouldNotify) {
      // Fire-and-forget, matching the HTTP route: a slow Discord must not
      // delay anything. notifyIssue is documented to never reject, but the
      // .catch() guards the seam anyway — an injected notify (tests, a
      // future refactor) is not guaranteed to honor that, and an uncaught
      // rejection on a void'd call would escape this function's own
      // try/catch entirely.
      void notify(result).catch(() => {});
    }
  } catch (captureErr) {
    console.warn("[IssueNitroErrors] Failed to capture:", captureErr);
  }
}
