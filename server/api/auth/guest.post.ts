import { useDb } from "~~/server/db/client";
import { users } from "~~/server/db/schema";

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
  const [user] = await db
    .insert(users)
    .values({ name: username, isGuest: true })
    .returning();

  await setUserSession(event, {
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

  return { user: (await getUserSession(event)).user };
});
