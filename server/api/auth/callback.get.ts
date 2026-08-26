import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users } from "~/server/db/schema";

const STATE_COOKIE = "discord_oauth_state";

interface DiscordUserResponse {
  id: string;
  username: string;
  avatar: string | null;
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const baseUrl = config.public.baseUrl as string;
  const query = getQuery(event);

  const code = query.code as string | undefined;
  const state = query.state as string | undefined;
  const expectedState = getCookie(event, STATE_COOKIE);
  setCookie(event, STATE_COOKIE, "", { path: "/", maxAge: 0 });

  if (query.error || !code) {
    return sendRedirect(event, `${baseUrl}/?error=oauth_failed`);
  }
  if (!state || !expectedState || state !== expectedState) {
    return sendRedirect(event, `${baseUrl}/?error=oauth_state_mismatch`);
  }

  const clientId = config.public.discordClientId as string;
  const clientSecret = config.discordClientSecret as string;

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${baseUrl}/api/auth/callback`,
    }),
  });
  if (!tokenResponse.ok) {
    return sendRedirect(event, `${baseUrl}/?error=code_exchange_failed`);
  }
  const tokenData = await tokenResponse.json();

  const profileResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!profileResponse.ok) {
    return sendRedirect(event, `${baseUrl}/?error=profile_fetch_failed`);
  }
  const profile: DiscordUserResponse = await profileResponse.json();
  const avatarUrl = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=128`
    : null;

  const db = useDb();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.discordUserId, profile.id))
    .limit(1);

  let user: typeof users.$inferSelect;
  if (existing) {
    [user] = await db
      .update(users)
      .set({ name: profile.username, avatarUrl })
      .where(eq(users.id, existing.id))
      .returning();
  } else {
    [user] = await db
      .insert(users)
      .values({
        discordUserId: profile.id,
        name: profile.username,
        avatarUrl,
        isGuest: false,
      })
      .returning();
  }

  await setUserSession(event, {
    user: {
      id: user.id,
      discordUserId: user.discordUserId,
      isGuest: user.isGuest,
      name: user.name,
      avatarUrl: user.avatarUrl,
      activeDecoration: user.activeDecoration,
      isAdmin: user.isAdmin,
    },
  });

  return sendRedirect(event, `${baseUrl}/auth/callback`);
});
