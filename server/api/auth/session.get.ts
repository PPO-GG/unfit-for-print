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
  const [row] = await useDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, sessionUser.id!))
    .limit(1);

  if (!row) {
    await clearUserSession(event);
    return { user: null };
  }

  return { user: sessionUser };
});
