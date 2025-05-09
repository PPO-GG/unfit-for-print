import {Client, Databases, Account, Functions, Users, Teams} from 'node-appwrite'

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
    functions: new Functions(client),
    users: new Users(client),
    teams: new Teams(client),
  }
}