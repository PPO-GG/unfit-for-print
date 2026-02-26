// server/api/debug/env-check.get.ts
// Temporary diagnostic endpoint to verify Worker environment variables.
// Returns which runtimeConfig keys are set (values redacted) so we can
// diagnose the Pages→Workers env migration.
// TODO: Remove this endpoint once env issues are confirmed resolved.

export default defineEventHandler(() => {
  const config = useRuntimeConfig();

  const check = (val: unknown) =>
    val ? `SET (${String(val).length} chars)` : "MISSING";

  return {
    _note:
      "Diagnostic endpoint — remove after env migration is confirmed working",
    server: {
      appwriteApiKey: check((config as any).appwriteApiKey),
      appwriteApiKeyFromProcessEnv: check(process.env.NUXT_APPWRITE_API_KEY),
      elevenlabsApiKey: check((config as any).elevenlabsApiKey),
    },
    public: {
      appwriteEndpoint: config.public.appwriteEndpoint || "MISSING",
      appwriteProjectId: check(config.public.appwriteProjectId),
      appwriteDatabaseId: check(config.public.appwriteDatabaseId),
      appwriteLobbyCollectionId: check(config.public.appwriteLobbyCollectionId),
      baseUrl: config.public.baseUrl || "MISSING",
    },
  };
});
