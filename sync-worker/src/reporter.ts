// Forwards this worker's own failures into unfit's issue pipeline, over the
// same public endpoint teleportal-server/src/issueReporter.ts used. The
// platform stays "teleportal" so existing issue fingerprints keep grouping.
//
// Must never throw or reject: it runs from inside error handlers.

const REPORT_TIMEOUT_MS = 3000;

export function createReporter(fetchFn: typeof fetch, webAppUrl: string) {
  return async (error: unknown): Promise<void> => {
    try {
      await fetchFn(`${webAppUrl}/api/issues/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "server-error",
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          platform: "teleportal",
        }),
        signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
      });
    } catch {
      // Deliberately silent; the caller already logged the original error.
    }
  };
}

export function reportError(env: Env, error: unknown): Promise<void> {
  console.error("[sync]", error);
  return createReporter(fetch, env.WEB_APP_URL)(error);
}
