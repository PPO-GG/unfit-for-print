// app/plugins/appwrite.ts
// Client-side Appwrite SDK initialization.
// Replaces the nuxt-appwrite module's plugin with a direct setup
// that reads from the flat runtimeConfig keys we already define.

import {
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

const client = new Client();

const services = {
  client,
  account: new Account(client),
  databases: new Databases(client),
  storage: new Storage(client),
  functions: new Functions(client),
  messaging: new Messaging(client),
  teams: new Teams(client),
  realtime: new Realtime(client),
  avatars: new Avatars(client),
};

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();

  const endpoint = config.public.appwriteEndpoint as string;
  const projectId = config.public.appwriteProjectId as string;

  if (endpoint && projectId) {
    client.setEndpoint(endpoint).setProject(projectId);
  } else {
    console.warn("[appwrite] Missing endpoint or projectId in runtime config.");
  }

  return {
    provide: {
      appwrite: services,
    },
  };
});
