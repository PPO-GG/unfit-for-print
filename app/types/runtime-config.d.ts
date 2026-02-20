export {};

declare module "nuxt/schema" {
  interface PublicRuntimeConfig {
    appwriteWhiteCardCollectionId: string;
    appwriteBlackCardCollectionId: string;
    appwriteLobbyCollectionId: string;
    appwritePlayerCollectionId: string;
    appwriteGamecardsCollectionId: string;
    appwriteGamechatCollectionId: string;
    appwriteGameSettingsCollectionId: string;
    appwriteSubmissionCollectionId: string;
    appwriteReportsCollectionId: string;
    appwriteFunctionsStartGame: string;
    appwriteFunctionsPlayCard: string;
    appwriteFunctionsSelectWinner: string;
    appwriteFunctionsStartNextRound: string;
    baseUrl: string;
    appVersion: string;
  }
}
