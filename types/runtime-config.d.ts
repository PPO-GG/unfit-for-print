export {};

declare module "nuxt/schema" {
  interface RuntimeConfig {
    appwriteUrl: string;
    appwriteProjectId: string;
    appwriteDatabaseId: string;
    appwriteWhiteCardCollectionId: string;
    appwriteBlackCardCollectionId: string;
    baseUrl: string;
    oAuthRedirectUrl: string;
    oAuthFailUrl: string;
    appwriteApiKey: string;
  }

  interface PublicRuntimeConfig {
    appwriteUrl: string;
    appwriteProjectId: string;
    appwriteDatabaseId: string;
    appwriteWhiteCardCollectionId: string;
    appwriteBlackCardCollectionId: string;
    baseUrl: string;
    oAuthRedirectUrl: string;
    oAuthFailUrl: string;
  }
}
