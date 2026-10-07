// When a room pushes its summary to the registry.

/**
 * `lastActivity` changes on every edit, so it is left out of the dedupe key.
 * Without a refresh the registry's copy (and /status idleSec) would go stale
 * during active play; push again once it is this far behind.
 */
export const ACTIVITY_REFRESH_MS = 30_000;

/**
 * @param prevKey      key of the last successful push, or null if none
 * @param prevActivity lastActivity sent with that push
 * @param key          key of the record about to be pushed (lastActivity zeroed)
 * @param activity     the record's lastActivity
 */
export function shouldPush(
  prevKey: string | null,
  prevActivity: number,
  key: string,
  activity: number,
): boolean {
  if (key !== prevKey) return true;
  return activity - prevActivity >= ACTIVITY_REFRESH_MS;
}
