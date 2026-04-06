export {};

declare module "nuxt/schema" {
  interface PublicRuntimeConfig {
    appwriteWhiteCardCollectionId: string;
    appwriteBlackCardCollectionId: string;
    appwriteLobbyCollectionId: string;
    appwritePlayerCollectionId: string;
    appwriteSubmissionCollectionId: string;
    appwriteReportsCollectionId: string;
    baseUrl: string;
    appVersion: string;
  }
}
