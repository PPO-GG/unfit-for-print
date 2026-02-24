// server/utils/adminOnly.ts
import { H3Event, createError } from "h3";
import { Client, Account } from "node-appwrite";

/**
 * Verifies the caller is an authenticated user with the "admin" label.
 *
 * Admin access is granted by assigning the "admin" label to a user in
 * the Appwrite console (Users → select user → Labels).
 * No team membership or env var required.
 *
 * Use this in any API route with: `await assertAdmin(event)`
 */
export async function assertAdmin(event: H3Event) {
  // Reuse the same multi-source session extraction that requireAuth uses
  const session = extractAdminSession(event);

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required",
    });
  }

  const config = useRuntimeConfig();

  // Build a user-scoped client so account.get() returns THIS user's data
  const client = new Client()
    .setEndpoint(config.public.appwriteEndpoint as string)
    .setProject(config.public.appwriteProjectId as string)
    .setSession(session);

  const account = new Account(client);

  let user: Awaited<ReturnType<typeof account.get>>;
  try {
    user = await account.get();
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid or expired session",
    });
  }

  // Labels are assigned via the Appwrite console or admin SDK.
  // Grant the "admin" label to any user who should have admin access.
  if (!user.labels?.includes("admin")) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden: admin access required",
    });
  }
}

/**
 * Extracts the session token from Authorization header or Appwrite session cookie.
 * Mirrors the logic in requirePlayer.ts so both utils work the same way.
 */
function extractAdminSession(event: H3Event): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = getHeader(event, "Authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);

  // 2. x-appwrite-session header (explicit, used by admin tools)
  const headerSession = getHeader(event, "x-appwrite-session");
  if (headerSession) return headerSession;

  // 3. Appwrite session cookie
  const cookies = parseCookies(event);
  const config = useRuntimeConfig();
  const projectId = config.public.appwriteProjectId as string;

  const cookieName = `a_session_${projectId}`;
  if (cookies[cookieName]) return cookies[cookieName];

  const legacyCookieName = `a_session_${projectId}_legacy`;
  if (cookies[legacyCookieName]) return cookies[legacyCookieName];

  return null;
}
