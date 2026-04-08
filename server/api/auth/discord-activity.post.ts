import { Query, ID } from "node-appwrite";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const { code } = await readBody<{ code: string }>(event);

  if (!code) {
    throw createError({
      statusCode: 400,
      message: "Missing authorization code",
    });
  }

  const clientId = config.public.discordClientId as string;
  const clientSecret = config.discordClientSecret as string;

  if (!clientId || !clientSecret) {
    throw createError({
      statusCode: 500,
      message: "Discord credentials not configured",
    });
  }

  // 1. Exchange Discord authorization code for access token
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
    const error = await tokenResponse.text();
    console.error("[Discord Activity] Token exchange failed:", error);
    throw createError({
      statusCode: 401,
      message: "Discord token exchange failed",
    });
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token as string;

  // 2. Fetch Discord user identity
  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userResponse.ok) {
    throw createError({
      statusCode: 401,
      message: "Failed to fetch Discord user",
    });
  }

  const discordUser = await userResponse.json();
  const discordUserId = discordUser.id as string;
  const discordUsername = discordUser.username as string;
  const discordAvatar = discordUser.avatar as string | null;
  const avatarUrl = discordAvatar
    ? `https://cdn.discordapp.com/avatars/${discordUserId}/${discordAvatar}.png?size=128`
    : null;

  // 3. Find or create Appwrite user
  const { users } = useAppwriteAdmin();
  let appwriteUserId: string | null = null;

  // 3a. Check Appwrite identities (web OAuth users)
  try {
    const identities = await users.listIdentities([
      Query.equal("providerUid", discordUserId),
      Query.equal("provider", "discord"),
    ]);
    if (identities.total > 0) {
      appwriteUserId = identities.identities[0]?.userId ?? null;
    }
  } catch (err) {
    console.warn("[Discord Activity] Identity lookup failed:", err);
  }

  // 3b. Check labels (Activity-created users)
  if (!appwriteUserId) {
    try {
      const labeled = await users.list([
        Query.contains("labels", [`dsc${discordUserId}`]),
      ]);
      if (labeled.total > 0) {
        appwriteUserId = labeled.users[0]?.$id ?? null;
      }
    } catch (err) {
      console.warn("[Discord Activity] Label lookup failed:", err);
    }
  }

  // 3c. Create new user if not found
  if (!appwriteUserId) {
    try {
      const newUser = await users.create(
        ID.unique(),
        undefined, // email
        undefined, // phone
        undefined, // password
        discordUsername,
      );
      appwriteUserId = newUser.$id;

      await users.updateLabels(appwriteUserId, [
        ...(newUser.labels || []),
        `dsc${discordUserId}`,
      ]);
    } catch (err) {
      console.error("[Discord Activity] User creation failed:", err);
      throw createError({
        statusCode: 500,
        message: "Failed to create user account",
      });
    }
  }

  // 4. Update user profile (name + avatar prefs)
  try {
    await users.updateName(appwriteUserId, discordUsername);
    const currentPrefs = await users.getPrefs(appwriteUserId);
    await users.updatePrefs(appwriteUserId, {
      ...currentPrefs,
      discordUserId,
      avatar: discordAvatar,
      avatarUrl,
    });
  } catch (err) {
    console.warn("[Discord Activity] Profile update failed (non-fatal):", err);
  }

  // 5. Create Appwrite session server-side using admin SDK
  // This avoids the client calling POST /v1/account/sessions/token directly,
  // which fails in Discord Activity iframes due to proxy routing issues.
  // The admin SDK returns session.secret (only populated with API key auth).
  let sessionSecret: string;
  try {
    const session = await users.createSession({ userId: appwriteUserId });
    sessionSecret = session.secret;
  } catch (err) {
    console.error("[Discord Activity] Session creation failed:", err);
    throw createError({ statusCode: 500, message: "Failed to create session" });
  }

  // 6. Return credentials
  return {
    userId: appwriteUserId,
    secret: sessionSecret,
    accessToken,
    discordUser: {
      id: discordUserId,
      username: discordUsername,
      avatar: discordAvatar,
      avatarUrl,
    },
  };
});
