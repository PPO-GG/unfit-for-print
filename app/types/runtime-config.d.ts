export {};

declare module "nuxt/schema" {
  interface PublicRuntimeConfig {
    baseUrl: string;
    appVersion: string;
  }
}
