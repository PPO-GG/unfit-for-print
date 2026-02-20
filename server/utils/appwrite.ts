// server/utils/appwrite.ts
// Re-export the nuxt-appwrite module's server utilities for backward compatibility.
// Server routes using `createAppwriteClient()` should migrate to `useAppwriteAdmin()`.
export function createAppwriteClient() {
  return useAppwriteAdmin();
}
