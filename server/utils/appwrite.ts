// server/utils/appwrite.ts
// Server-side Appwrite admin client — inlined from nuxt-appwrite module.
// Reads env vars directly to avoid Nuxt runtimeConfig nested-key mapping
// issues in Cloudflare Workers (NUXT_APPWRITE_API_KEY vs NUXT_APPWRITE__API_KEY).

import {
  Client,
  Databases,
  Users,
  Teams,
  Storage,
  Account,
  Messaging,
} from "node-appwrite";

// ─── Singleton admin client ──────────────────────────────────────

interface AdminClient {
  client: Client;
  databases: Databases;
  users: Users;
  teams: Teams;
  storage: Storage;
  messaging: Messaging;
}

let _adminClient: AdminClient | null = null;

function _createAdminClient(): AdminClient {
  const config = useRuntimeConfig();

  // Read from flat keys (match NUXT_PUBLIC_APPWRITE_ENDPOINT env var)
  const endpoint = config.public.appwriteEndpoint as string;
  const projectId = config.public.appwriteProjectId as string;

  // API key: try the flat runtimeConfig key first (NUXT_APPWRITE_API_KEY),
  // then fall back to process.env directly for Cloudflare Workers compatibility
  const apiKey =
    (config as any).appwriteApiKey ||
    (config as any).appwrite?.apiKey ||
    process.env.NUXT_APPWRITE_API_KEY ||
    "";

  if (!endpoint || !projectId) {
    throw new Error(
      "[appwrite-server] Missing endpoint or projectId. " +
        "Set NUXT_PUBLIC_APPWRITE_ENDPOINT and NUXT_PUBLIC_APPWRITE_PROJECT_ID.",
    );
  }

  if (!apiKey) {
    throw new Error(
      "[appwrite-server] Missing API key. Set NUXT_APPWRITE_API_KEY.",
    );
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  return {
    client,
    databases: new Databases(client),
    users: new Users(client),
    teams: new Teams(client),
    storage: new Storage(client),
    messaging: new Messaging(client),
  };
}

/**
 * Returns a singleton admin Appwrite client with full API key access.
 * All server routes should use this for DB operations.
 */
export function useAppwriteAdmin(): AdminClient {
  if (!_adminClient) {
    _adminClient = _createAdminClient();
  }
  return _adminClient;
}

/** @deprecated Use `useAppwriteAdmin()` instead. */
export function createAppwriteClient(): AdminClient {
  return useAppwriteAdmin();
}

// ─── JWT-scoped client ───────────────────────────────────────────

interface JWTClient {
  client: Client;
  account: Account;
  databases: Databases;
}

/**
 * Creates a new (non-singleton) client without an API key.
 * Caller MUST call `client.setJWT(token)` before use.
 */
export function useAppwriteJWT(): JWTClient {
  const config = useRuntimeConfig();
  const endpoint = config.public.appwriteEndpoint as string;
  const projectId = config.public.appwriteProjectId as string;

  if (!endpoint || !projectId) {
    throw new Error(
      "[appwrite-server] Missing endpoint or projectId for JWT client.",
    );
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId);

  return {
    client,
    account: new Account(client),
    databases: new Databases(client),
  };
}
