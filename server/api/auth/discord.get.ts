import { OAuthProvider } from "node-appwrite";

/**
 * Server-side Discord OAuth initiation.
 * Uses node-appwrite's createOAuth2Token to generate the redirect URL.
 * This avoids the cross-origin cookie issue with client-side createOAuth2Session.
 *
 * After the user authorizes on Discord, Appwrite redirects back to
 * /auth/callback?userId=...&secret=... where the CLIENT SDK exchanges
 * the token for a session.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const { client } = useAppwriteAdmin();

  const { Account } = await import("node-appwrite");
  const account = new Account(client);

  const baseUrl = config.public.baseUrl as string;

  // Redirect back to the CLIENT-side callback page.
  // Appwrite will append ?userId=...&secret=... to this URL.
  const successUrl = `${baseUrl}/auth/callback`;
  const failureUrl = `${baseUrl}/?error=oauth_failed`;

  try {
    const redirectUrl = await account.createOAuth2Token(
      OAuthProvider.Discord,
      successUrl,
      failureUrl,
      ["identify"],
    );

    await sendRedirect(event, redirectUrl);
  } catch (error: any) {
    console.error(
      "[Auth] Discord OAuth token creation failed:",
      error.message || error,
    );
    await sendRedirect(event, `${baseUrl}/?error=oauth_init_failed`);
  }
});
