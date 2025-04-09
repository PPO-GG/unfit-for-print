// plugins/appwrite.client.ts
import { Client, Databases, Account } from 'appwrite'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const client = new Client()
    .setEndpoint(config.public.appwriteUrl)
    .setProject(config.public.appwriteProjectId)

  const databases = new Databases(client)
  const account = new Account(client)
  return {
    provide: {
      appwrite: {
        client,
        databases,
        account,
      }
    }
  }
})
