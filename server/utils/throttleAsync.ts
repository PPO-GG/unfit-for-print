// server/utils/throttleAsync.ts
// Limits how often an async job runs, and shares a run already in progress.
//
// A call while the job is running waits for that run instead of starting a
// second one. A call within `minIntervalMs` of the last run finishing does not
// run the job at all and resolves to `skipped` straight away.

export interface ThrottledAsync<T> {
  (): Promise<T>;
  /** Forgets the last run, so the next call runs the job. For tests. */
  reset(): void;
}

export function throttleAsync<T>(
  job: () => Promise<T>,
  minIntervalMs: number,
  skipped: T,
  now: () => number = Date.now,
): ThrottledAsync<T> {
  let inFlight: Promise<T> | null = null;
  let lastFinishedAt = Number.NEGATIVE_INFINITY;

  const run = (() => {
    if (inFlight) return inFlight;
    if (now() - lastFinishedAt < minIntervalMs) return Promise.resolve(skipped);

    // Measured from when the run finishes, so a slow run is not immediately
    // followed by another. A failed run counts too: retrying a failure on
    // every call is exactly the load this exists to prevent.
    const current = job().finally(() => {
      lastFinishedAt = now();
      if (inFlight === current) inFlight = null;
    });
    inFlight = current;
    return current;
  }) as ThrottledAsync<T>;

  run.reset = () => {
    inFlight = null;
    lastFinishedAt = Number.NEGATIVE_INFINITY;
  };

  return run;
}
