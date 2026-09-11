import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { users } from "~~/server/db/schema";

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  // See server/utils/session.ts: nuxt-auth-utils' `User` carries no id in its
  // types, so the id is narrowed once here.
  const sessionUser = (session.user ?? null) as { id?: string } | null;
  if (!sessionUser?.id) return { user: null };

  // The client keys "am I logged in" off this response, so a session naming a
  // deleted account left it permanently convinced it was signed in — every
  // request then failed and nothing ever re-authenticated. Leaving a lobby
  // deletes an ephemeral guest, which is exactly how that happens.
  //
  // The profile comes from the row, not the cookie: the cookie is written once
  // at login, so anything changed since — equipping a decoration, most visibly —
  // was reverted on the next page load.
  const [row] = await useDb()
    .select({
      id: users.id,
      discordUserId: users.discordUserId,
      isGuest: users.isGuest,
      name: users.name,
      avatarUrl: users.avatarUrl,
      activeDecoration: users.activeDecoration,
      isAdmin: users.isAdmin,
    })
    .from(users)
    .where(eq(users.id, sessionUser.id!))
    .limit(1);

  if (!row) {
    await clearUserSession(event);
    return { user: null };
  }

  return { user: row };
});
