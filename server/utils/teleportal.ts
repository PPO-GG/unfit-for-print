// server/utils/teleportal.ts
// Derives the Teleportal HTTP base URL from the WS-based config value.

export function getTeleportalHttpUrl(): string {
  const config = useRuntimeConfig();
  const wsUrl = (config.public.lobbyTeleportalUrl as string) || "ws://localhost:1235";
  return wsUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
}

/**
 * Bearer header for the sync server's admin endpoints (/status, /gc).
 * Unset token → no header at all, so the server answers 401 and callers
 * fail safe (pruneLobbies treats that as "server offline").
 */
export function teleportalAdminHeaders(): Record<string, string> {
  const token = (useRuntimeConfig().syncAdminToken as string | undefined) || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}
