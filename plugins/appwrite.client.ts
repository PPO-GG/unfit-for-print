// plugins/appwrite.client.ts
import { Client, Databases, Account, Functions } from 'appwrite'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const client = new Client()
      .setEndpoint(config.public.appwriteUrl)
      .setProject(config.public.appwriteProjectId);

  const databases = new Databases(client);
  const account = new Account(client);
  const functions = new Functions(client); // ✅ this must exist

  return {
    provide: {
      appwrite: {
        client,
        account,
        databases,
        functions // ✅ this must be here too
      }
    }
  };
});