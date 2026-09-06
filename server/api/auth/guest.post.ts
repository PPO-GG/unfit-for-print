// server/api/auth/guest.post.ts
//
// The only unauthenticated route that writes to `users`. Two things keep that
// from growing without bound:
//
//   1. A caller who already holds a guest session is renamed in place instead
//      of getting a second row. This is the common case, not the rare one —
//      the join screen calls this whenever the name field is submitted, so
//      retyping a name used to cost a row every time.
//   2. Callers without one are throttled per IP.
import { and, eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { users } from "~~/server/db/schema";
import { consumeRateLimit } from "~~/server/utils/rateLimit";

const WINDOW_MS = 10 * 60 * 1000;

/** The session payload every branch below returns, so a guest looks the same
 *  whether they were just created or renamed. */
const guestSession = (user: { id: string; name: string | null }) => ({
  user: {
    id: user.id,
    discordUserId: null,
    isGuest: true,
    name: user.name,
    avatarUrl: null,
    activeDecoration: null,
    isAdmin: false,
  },
});

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username?: string }>(event);
  const username = body?.username?.trim();

  if (!username || username.length < 1 || username.length > 32) {
    throw createError({
      statusCode: 400,
      statusMessage: "username must be 1-32 characters",
    });
  }

  const db = useDb();

  // Reuse before create. Restricted to sessions that are already guests: a
  // signed-in Discord account must never be renamed by this route.
  const current = (await getUserSession(event))?.user as
    | { id?: string; isGuest?: boolean }
    | undefined;

  if (current?.id && current.isGuest) {
    // The row can be gone — a pruned guest, or a wiped database — in which
    // case this falls through and mints a new identity rather than 500ing on
    // an update that matches nothing.
    const [existing] = await db
      .update(users)
      .set({ name: username })
      .where(and(eq(users.id, current.id), eq(users.isGuest, true)))
      .returning();

    if (existing) {
      await setUserSession(event, guestSession(existing));
      return { user: (await getUserSession(event)).user };
    }
  }

  // Per-IP throttle on new identities only, so the reuse path above stays
  // free. NOTE: this is only as granular as the IP the app actually sees. If
  // it ever ends up behind a proxy that does not set X-Forwarded-For, every
  // caller shares one bucket — set NUXT_GUEST_RATE_LIMIT=0 to switch the
  // throttle off rather than locking legitimate players out.
  const limit = useRuntimeConfig(event).guestRateLimit;
  if (limit > 0) {
    const ip = getRequestIP(event, { xForwardedFor: true }) || "unknown";
    const gate = consumeRateLimit(`auth:guest:${ip}`, {
      limit,
      windowMs: WINDOW_MS,
    });
    if (!gate.allowed) {
      setResponseHeader(event, "Retry-After", gate.retryAfterSeconds);
      throw createError({
        statusCode: 429,
        statusMessage: "Too many guest sessions from this address. Try again shortly.",
      });
    }
  }

  const [user] = await db
    .insert(users)
    .values({ name: username, isGuest: true })
    .returning();

  await setUserSession(event, guestSession(user!));

  return { user: (await getUserSession(event)).user };
});
