import { Query } from "node-appwrite";

/**
 * POST /api/auth/discord-avatar
 *
 * Uses the admin SDK to:
 *   1. Fetch the user's Discord identity (providerUid + providerAccessToken)
 *   2. Call Discord /users/@me with the provider token to get avatar hash
 *   3. Return { discordUserId, avatar } so the client can persist to prefs
 *
 * Body: { userId: string }
 *
 * Security: requireAuth ensures a valid Appwrite session exists. We then
 * assert that the requested userId matches the authenticated caller so
 * a user cannot fetch another user's Discord provider token (IDOR).
 */
export default defineEventHandler(async (event) => {
  // Verify the caller has a valid Appwrite session.
  const authenticatedUserId = await requireAuth(event);

  const body = await readBody(event);
  const userId = body?.userId;

  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "userId is required" });
  }

  // Prevent IDOR: users may only fetch their own Discord identity.
  if (userId !== authenticatedUserId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden: you may only fetch your own Discord avatar",
    });
  }

  const { client } = useAppwriteAdmin();
  const { Users } = await import("node-appwrite");
  const users = new Users(client);

  try {
    // Get all identities for this user
    const identities = await users.listIdentities([
      Query.equal("userId", userId),
    ]);

    // Find the Discord identity
    const discordIdentity = identities.identities.find(
      (id: any) => id.provider === "discord",
    );

    if (!discordIdentity) {
      console.log("[discord-avatar] No Discord identity found for", userId);
      return { discordUserId: null, avatar: null, avatarUrl: null };
    }

    const discordUserId = discordIdentity.providerUid;
    let avatarHash: string | null = null;

    // Try using the provider access token to fetch from Discord API
    if (discordIdentity.providerAccessToken) {
      try {
        const res = await fetch("https://discord.com/api/users/@me", {
          headers: {
            Authorization: `Bearer ${discordIdentity.providerAccessToken}`,
          },
        });

        if (res.ok) {
          const discordUser = await res.json();
          avatarHash = discordUser.avatar;
          console.log("[discord-avatar] Got avatar from Discord API:", {
            discordUserId,
            avatarHash,
          });
        } else {
          console.warn(
            "[discord-avatar] Discord API returned",
            res.status,
            await res.text(),
          );
        }
      } catch (err) {
        console.error("[discord-avatar] Discord API call failed:", err);
      }
    } else {
      console.log(
        "[discord-avatar] No providerAccessToken available for identity",
      );
    }

    // Build the full CDN URL if we have both pieces
    const avatarUrl =
      discordUserId && avatarHash
        ? `https://cdn.discordapp.com/avatars/${discordUserId}/${avatarHash}.png?size=128`
        : null;

    return {
      discordUserId,
      avatar: avatarHash,
      avatarUrl,
    };
  } catch (err: any) {
    console.error("[discord-avatar] Error:", err.message || err);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch Discord avatar",
    });
  }
});
