// plugins/appwrite.server.ts
import { Client, Databases, Account, Functions } from 'node-appwrite'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const client = new Client()
    .setEndpoint(config.public.appwriteUrl)
    .setProject(config.public.appwriteProjectId)
    .setKey(config.appwriteApiKey)
    .setSelfSigned(true)

  const databases = new Databases(client)
  const account = new Account(client)
  const functions = new Functions(client)

  return {
    provide: {
      appwrite: {
        client,
        databases,
        account,
        functions
      }
    }
  }
})
