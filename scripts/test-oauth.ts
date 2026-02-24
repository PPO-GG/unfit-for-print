import { Client, Account, OAuthProvider } from "node-appwrite";
import dotenv from "dotenv";
dotenv.config();

const client = new Client();
client
  .setEndpoint(process.env.NUXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NUXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.NUXT_APPWRITE_API_KEY);

const account = new Account(client);

(async () => {
  try {
    const res = await account.createOAuth2Token({ provider: OAuthProvider.Discord, success: "https://unfit.cards/auth/callback", failure: "https://unfit.cards/?error=oauth_failed", scopes: ["identify"] });
    console.log("SUCCESS:", res);
  } catch (e) {
    console.error("ERROR MESSAGE:", e.message);
  }
})();
