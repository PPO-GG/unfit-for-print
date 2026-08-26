import { useDb } from "~/server/db/client";
import { users } from "~/server/db/schema";
import { signActivityToken } from "~/server/utils/activityToken";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const { code } = await readBody<{ code: string }>(event);

  if (!code) {
    throw createError({ statusCode: 400, message: "Missing authorization code" });
  }

  const clientId = config.public.discordClientId as string;
  const clientSecret = config.discordClientSecret as string;
  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 500, message: "Discord credentials not configured" });
  }

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!tokenResponse.ok) {
    throw createError({ statusCode: 401, message: "Discord token exchange failed" });
  }
  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token as string;

  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userResponse.ok) {
    throw createError({ statusCode: 401, message: "Failed to fetch Discord user" });
  }
  const discordUser = await userResponse.json();
  const discordUserId = discordUser.id as string;
  const discordUsername = discordUser.username as string;
  const discordAvatar = discordUser.avatar as string | null;
  const avatarUrl = discordAvatar
    ? `https://cdn.discordapp.com/avatars/${discordUserId}/${discordAvatar}.png?size=128`
    : null;

  const db = useDb();
  const [user] = await db
    .insert(users)
    .values({ discordUserId, name: discordUsername, avatarUrl, isGuest: false })
    .onConflictDoUpdate({
      target: users.discordUserId,
      set: { name: discordUsername, avatarUrl, isGuest: false },
    })
    .returning({ id: users.id });

  const token = signActivityToken(user.id);

  return {
    token,
    accessToken,
    discordUser: { id: discordUserId, username: discordUsername, avatar: discordAvatar, avatarUrl },
  };
});
