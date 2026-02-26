// server/utils/fetch-shim.mjs
// Shim for node-fetch-native-with-agent that uses native Web APIs.
// Used in Cloudflare Workers where Node.js http/https agents are unavailable.
export default globalThis.fetch;
export const fetch = globalThis.fetch;
export const Headers = globalThis.Headers;
export const Request = globalThis.Request;
export const Response = globalThis.Response;
export const File = globalThis.File;
export const FormData = globalThis.FormData;
export const Blob = globalThis.Blob;
export const AbortController = globalThis.AbortController;
export function createProxy() {
  return undefined;
}
export function createAgent() {
  return undefined;
}
