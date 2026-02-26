// app/composables/useAppwrite.ts
// Client-side composable providing all Appwrite services and helpers.
// Replaces the nuxt-appwrite module's auto-imported composable.

import type {
  Client,
  Account,
  Databases,
  Storage,
  Functions,
  Messaging,
  Teams,
  Realtime,
  Avatars,
} from "appwrite";

interface AppwriteServices {
  client: Client;
  account: Account;
  databases: Databases;
  storage: Storage;
  functions: Functions;
  messaging: Messaging;
  teams: Teams;
  realtime: Realtime;
  avatars: Avatars;
}

export const useAppwrite = () => {
  const nuxtApp = useNuxtApp();
  const $appwrite = nuxtApp.$appwrite as unknown as AppwriteServices;
  const config = useRuntimeConfig();

  return {
    // ─── Raw Services ─────────────────────────────────────────
    client: $appwrite.client,
    account: $appwrite.account,
    databases: $appwrite.databases,
    storage: $appwrite.storage,
    functions: $appwrite.functions,
    messaging: $appwrite.messaging,
    teams: $appwrite.teams,
    realtime: $appwrite.realtime,
    avatars: $appwrite.avatars,

    // ─── Convenient Aliases ───────────────────────────────────
    db: $appwrite.databases,
    auth: $appwrite.account,

    // ─── Config Constants ─────────────────────────────────────
    DATABASE_ID: config.public.appwriteDatabaseId as string,
    ENDPOINT: config.public.appwriteEndpoint as string,
    PROJECT_ID: config.public.appwriteProjectId as string,

    // ─── Helper Methods ───────────────────────────────────────
    async query(
      collectionId: string,
      queries: string[] = [],
      databaseId?: string,
    ) {
      return await $appwrite.databases.listDocuments(
        databaseId || (config.public.appwriteDatabaseId as string),
        collectionId,
        queries,
      );
    },

    async getDocument(
      collectionId: string,
      documentId: string,
      queries: string[] = [],
      databaseId?: string,
    ) {
      return await $appwrite.databases.getDocument(
        databaseId || (config.public.appwriteDatabaseId as string),
        collectionId,
        documentId,
        queries,
      );
    },

    subscribe(channel: string, callback: (payload: any) => void) {
      return $appwrite.realtime.subscribe(channel, callback);
    },
  };
};
