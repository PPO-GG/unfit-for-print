// server/utils/teleportal.ts
// Derives the Teleportal HTTP base URL from the WS-based config value.

export function getTeleportalHttpUrl(): string {
  const config = useRuntimeConfig();
  const wsUrl = (config.public.lobbyTeleportalUrl as string) || "ws://localhost:1235";
  return wsUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
}
