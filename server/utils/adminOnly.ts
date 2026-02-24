// server/middleware/adminOnly.ts
import { H3Event, createError, getHeader } from "h3";
import { useRuntimeConfig } from "#imports";

/**
 * Lightweight admin check using team membership.
 * Use this in any API route with: `await assertAdmin(event)`
 */
export async function assertAdmin(event: H3Event) {
  const config = useRuntimeConfig();
  const session = getHeader(event, "Authorization")?.replace("Bearer ", "");
  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Missing session token",
    });
  }

  const { client, teams } = createAppwriteClient();
  client.setSession(session);

  const ADMIN_TEAM_ID = config.public.appwriteAdminTeamId;
  const memberships = await teams.listMemberships({ teamId: ADMIN_TEAM_ID });
  const isAdmin = memberships.memberships.some(
    (m: any) => m.userId && m.confirm,
  );

  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden: Admins only",
    });
  }
}
