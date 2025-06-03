// plugins/appwrite.client.ts
import { Client, Databases, Account, Functions, Teams } from 'appwrite'

function ensureString(value: unknown, name: string): string {
  if (value === null || value === undefined) {
    throw new Error(`${name} is missing`);
  }
  // Convert to string if it's a number or boolean
  const stringValue = String(value);
  if (!stringValue) {
    throw new Error(`${name} is empty`);
  }
  return stringValue;
}

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  // Create a safe copy of the config with string-enforced collection IDs
  const safeConfig = {
    ...config,
    public: {
      ...config.public,
      appwriteDatabaseId: ensureString(config.public.appwriteDatabaseId, 'appwriteDatabaseId'),
      appwriteLobbyCollectionId: ensureString(config.public.appwriteLobbyCollectionId, 'appwriteLobbyCollectionId'),
      appwritePlayerCollectionId: ensureString(config.public.appwritePlayerCollectionId, 'appwritePlayerCollectionId'),
      appwriteGamechatCollectionId: ensureString(config.public.appwriteGamechatCollectionId, 'appwriteGamechatCollectionId')
    }
  };

  // Log the configuration for debugging
  console.log('Configuration types:', {
    databaseIdType: typeof config.public.appwriteDatabaseId,
    lobbyCollectionIdType: typeof config.public.appwriteLobbyCollectionId,
    playerCollectionIdType: typeof config.public.appwritePlayerCollectionId,
    playerCollectionIdValue: config.public.appwritePlayerCollectionId,
    gamechatCollectionIdType: typeof config.public.appwriteGamechatCollectionId,
    gamechatCollectionIdValue: config.public.appwriteGamechatCollectionId
  });

  // Validate configuration
  if (!safeConfig.public.appwriteUrl || !safeConfig.public.appwriteProjectId) {
    console.error('Missing Appwrite configuration:', {
      url: safeConfig.public.appwriteUrl,
      projectId: safeConfig.public.appwriteProjectId
    });
    throw new Error('Appwrite configuration is missing. Check your environment variables.');
  }

  // Validate collection IDs
  if (!safeConfig.public.appwriteDatabaseId || 
      !safeConfig.public.appwriteLobbyCollectionId || 
      !safeConfig.public.appwritePlayerCollectionId ||
      !safeConfig.public.appwriteGamechatCollectionId ||
      safeConfig.public.appwriteLobbyCollectionId === 'Infinite' ||
      safeConfig.public.appwritePlayerCollectionId === 'Infinite' ||
      safeConfig.public.appwriteGamechatCollectionId === 'Infinite' ||
      safeConfig.public.appwriteLobbyCollectionId === 'undefined' ||
      safeConfig.public.appwritePlayerCollectionId === 'undefined' ||
      safeConfig.public.appwriteGamechatCollectionId === 'undefined') {
    console.error('Invalid Appwrite collection IDs:', {
      databaseId: safeConfig.public.appwriteDatabaseId,
      lobbyCollectionId: safeConfig.public.appwriteLobbyCollectionId,
      playerCollectionId: safeConfig.public.appwritePlayerCollectionId,
      gamechatCollectionId: safeConfig.public.appwriteGamechatCollectionId
    });
    throw new Error('Appwrite collection IDs are invalid. Check your environment variables.');
  }

  const client = new Client()
      .setEndpoint(safeConfig.public.appwriteUrl)
      .setProject(safeConfig.public.appwriteProjectId);

  const databases = new Databases(client);
  const account = new Account(client);
  const functions = new Functions(client);
  const teams = new Teams(client);

  return {
    provide: {
      appwrite: { // Provide an object with all services
        client,
        databases,
        account,
        functions,
        teams,
        safeConfig
      }
    }
  };
});
