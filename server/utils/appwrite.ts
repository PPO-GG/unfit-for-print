import {Client, Databases, Account, Functions, Users, Teams} from 'node-appwrite'

export function createAppwriteClient() {
  try {
    const config = useRuntimeConfig()

    // Validate configuration
    if (!config.public.appwriteUrl) {
      throw new Error('Appwrite URL is missing');
    }
    if (!config.public.appwriteProjectId) {
      throw new Error('Appwrite Project ID is missing');
    }
    if (!config.appwriteApiKey) {
      throw new Error('Appwrite API Key is missing');
    }

    const client = new Client()
      .setEndpoint(config.public.appwriteUrl)
      .setProject(config.public.appwriteProjectId)
      .setKey(config.appwriteApiKey)
      .setSelfSigned(true)

    return {
      client,
      databases: new Databases(client),
      account: new Account(client),
      functions: new Functions(client),
      users: new Users(client),
      teams: new Teams(client),
    }
  } catch (err) {
    console.error('[createAppwriteClient] Error initializing Appwrite client:', err)
    throw err
  }
}
