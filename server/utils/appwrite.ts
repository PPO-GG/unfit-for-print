import { Client, Databases, Account, Functions } from 'node-appwrite'

export function createAppwriteClient() {
  const config = useRuntimeConfig()

  const client = new Client()
    .setEndpoint(config.public.appwriteUrl)
    .setProject(config.public.appwriteProjectId)
    .setKey(config.appwriteApiKey)
    .setSelfSigned(true)

  return {
    client,
    databases: new Databases(client),
    account: new Account(client),
    functions: new Functions(client)
  }
}