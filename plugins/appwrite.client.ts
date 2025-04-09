// plugins/appwrite.client.ts
import { Client, Databases, Account, Avatars, Functions, Query } from 'appwrite'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const client = new Client()
    .setEndpoint(config.public.appwriteUrl)
    .setProject(config.public.appwriteProjectId)

  const databases = new Databases(client)
  const account = new Account(client)
  const avatars = new Avatars(client)
  const functions = new Functions(client)
  console.log("Appwrite config:", { account, databases })
  return {
    provide: {
      appwrite: {
        client,
        databases,
        account,
        avatars,
        functions,
        Query,
      }
    }
  }
})
