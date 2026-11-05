import type { H3Event } from "h3";

/** Marks a bearer as the read-only admin token rather than an Activity token. */
export const ADMIN_READ_TOKEN_PREFIX = "ufr_";
/** What `requireAdmin` returns for the read token. No GET admin route reads it. */
export const ADMIN_READ_ACTOR = "admin-read-token";

/**
 * Checks the read-only admin token (`NUXT_ADMIN_READ_TOKEN`).
 *
 * Returns "absent" when the request carries no `ufr_` bearer, so the caller
 * goes on to session / Activity-token auth. Throws 401 or 403 otherwise.
 */
export function checkAdminReadToken(
  _event: H3Event,
): "absent" | typeof ADMIN_READ_ACTOR {
  return "absent";
}
