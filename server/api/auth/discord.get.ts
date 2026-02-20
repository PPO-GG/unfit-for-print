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

  try {
    const endpoint = client.config.endpoint;
    const projectId = client.config.project;
    const apiKey = client.config.key;

    const urlObj = new URL(`${endpoint}/account/tokens/oauth2/discord`);
    urlObj.searchParams.set("success", successUrl);
    urlObj.searchParams.set("failure", failureUrl);
    // Note: Appwrite may expect an array format for scopes via HTTP
    urlObj.searchParams.set("scopes[]", "identify");

    const redirectUrl = await new Promise<string>((resolve, reject) => {
      import("https").then((https) => {
        const req = https.request(
          urlObj.toString(),
          {
            method: "GET",
            headers: {
              "X-Appwrite-Project": projectId,
              "X-Appwrite-Key": apiKey,
            },
          },
          (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
              if (res.headers.location) {
                resolve(res.headers.location);
              } else {
                reject(
                  new Error(
                    "No location header returned from Appwrite (301/302)",
                  ),
                );
              }
            } else {
              let body = "";
              res.on("data", (chunk) => (body += chunk));
              res.on("end", () => {
                reject(
                  new Error(
                    `Appwrite rejected init: [${res.statusCode}] ${body}`,
                  ),
                );
              });
            }
          },
        );

        req.on("error", (err) => reject(err));
        req.end();
      });
    });

    await sendRedirect(event, redirectUrl);
  } catch (error: any) {
    console.error(
      "[Auth] Discord OAuth token creation failed:",
      error.message || error,
      { successUrl, failureUrl, baseUrl },
    );
    await sendRedirect(
      event,
      `${baseUrl}/?error=oauth_init_failed&message=${encodeURIComponent(error.message || "unknown")}`,
    );
  }
});
