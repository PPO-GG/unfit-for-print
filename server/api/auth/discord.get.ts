import { OAuthProvider } from "node-appwrite";

/**
 * Server-side Discord OAuth initiation.
 * Uses node-appwrite's createOAuth2Token to generate the redirect URL.
 * This avoids the cross-origin cookie issue with client-side createOAuth2Session.
 *
 * IMPORTANT: The SDK builds the redirect URL locally — it does NOT make an
 * outbound HTTP request to Appwrite. This avoids Cloudflare Bot Fight Mode
 * challenges that block server-to-server requests to api.ppo.gg.
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

  const requestUrl = getRequestURL(event);
  let baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;

  if (!baseUrl || baseUrl === "http://") {
    baseUrl = config.public.baseUrl as string;
    if (baseUrl && !baseUrl.startsWith("http")) {
      baseUrl = `https://${baseUrl}`;
    }
  }

  // Redirect back to the CLIENT-side callback page.
  // Appwrite will append ?userId=...&secret=... to this URL.
  const successUrl = `${baseUrl}/auth/callback`;
  const failureUrl = `${baseUrl}/?error=oauth_failed`;

  console.log("[Auth] Discord OAuth attempt:", {
    baseUrl,
    successUrl,
    failureUrl,
    appwriteEndpoint: config.public.appwriteEndpoint || "(not set)",
    requestHost: requestUrl.host,
  });

  try {
    // NOTE: Despite the original comment, the SDK's redirect() method DOES make
    // an outbound fetch() to Appwrite. It expects a 301/302 redirect response.
    // If Appwrite rejects the redirect URLs (e.g. hostname not in platforms)
    // or Bot Fight Mode intercedes, it will throw "Invalid redirect".
    const redirectUrl = await account.createOAuth2Token({ provider: OAuthProvider.Discord, success: successUrl, failure: failureUrl, scopes: ["identify"] });

    await sendRedirect(event, redirectUrl);
  } catch (error: any) {
    console.error(
      "[Auth] Discord OAuth token creation failed:",
      error.message || error,
      {
        statusCode: error.code || error.status || "unknown",
        type: error.type || "unknown",
        successUrl,
        failureUrl,
        baseUrl,
        requestHost: requestUrl.host,
      },
    );
    await sendRedirect(
      event,
      `${baseUrl}/?error=oauth_init_failed&message=${encodeURIComponent(error.message || "unknown")}`,
    );
  }
});
