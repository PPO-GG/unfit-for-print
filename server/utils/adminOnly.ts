// server/utils/adminOnly.ts
import { H3Event, createError } from "h3";

/**
 * Verifies the caller is an authenticated user with the "admin" label.
 *
 * Admin access is granted by assigning the "admin" label to a user in
 * the Appwrite console (Users → select user → Labels).
 * No team membership or env var required.
 *
 * Uses `requireAuth()` for session verification, then checks for the
 * "admin" label on the resolved user via the admin SDK.
 *
 * Use this in any API route with: `await assertAdmin(event)`
 */
export async function assertAdmin(event: H3Event) {
  const userId = await requireAuth(event);

  const { users } = useAppwriteAdmin();
  const user = await users.get(userId);

  if (!user.labels?.includes("admin")) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden: admin access required",
    });
  }

  return userId;
}
