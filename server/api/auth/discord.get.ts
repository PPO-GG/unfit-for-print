import { randomBytes } from "node:crypto";

const DISCORD_AUTHORIZE_URL = "https://discord.com/api/oauth2/authorize";
const STATE_COOKIE = "discord_oauth_state";
const STATE_COOKIE_MAX_AGE_SEC = 600;

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const baseUrl = config.public.baseUrl as string;
  const clientId = config.public.discordClientId as string;

  if (!clientId) {
    return sendRedirect(event, `${baseUrl}/?error=oauth_misconfigured`);
  }

  const state = randomBytes(16).toString("hex");
  const isSecure = !baseUrl.startsWith("http://localhost");
  setCookie(event, STATE_COOKIE, state, {
    path: "/",
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: STATE_COOKIE_MAX_AGE_SEC,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: `${baseUrl}/api/auth/callback`,
    scope: "identify",
    state,
  });
  return sendRedirect(event, `${DISCORD_AUTHORIZE_URL}?${params.toString()}`, 302);
});
