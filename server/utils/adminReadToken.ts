import { createHash, timingSafeEqual } from "node:crypto";
import { createError, getHeader, type H3Event } from "h3";

/** Marks a bearer as the read-only admin token rather than an Activity token. */
export const ADMIN_READ_TOKEN_PREFIX = "ufr_";
/** What `requireAdmin` returns for the read token. No GET admin route reads it. */
export const ADMIN_READ_ACTOR = "admin-read-token";

const READ_METHODS = new Set(["GET", "HEAD"]);

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Checks the read-only admin token (`NUXT_ADMIN_READ_TOKEN`).
 *
 * Returns "absent" when the request carries no `ufr_` bearer, so the caller
 * goes on to session / Activity-token auth. A `ufr_` bearer never falls
 * through to those: it either passes here or throws 401 (wrong or no token
 * configured) or 403 (any method that is not GET or HEAD).
 */
export function checkAdminReadToken(
  event: H3Event,
): "absent" | typeof ADMIN_READ_ACTOR {
  const header = getHeader(event, "Authorization");
  if (!header?.startsWith(`Bearer ${ADMIN_READ_TOKEN_PREFIX}`)) return "absent";

  const expected = process.env.NUXT_ADMIN_READ_TOKEN;
  // Digests are equal length, so timingSafeEqual cannot throw on a short token.
  if (!expected || !timingSafeEqual(digest(header.slice(7)), digest(expected))) {
    throw createError({ statusCode: 401, statusMessage: "Invalid token" });
  }

  // Read from the request itself, not h3's `event.method`, which defaults a
  // missing method to GET. Missing here means refused.
  const method = event.node.req.method?.toUpperCase();
  if (!method || !READ_METHODS.has(method)) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden: read-only token",
    });
  }
  return ADMIN_READ_ACTOR;
}
