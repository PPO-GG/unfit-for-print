/**
 * Turns the Teleportal websocket base into its HTTP equivalent.
 *
 * The server exposes `GET /snapshot/:code` on the same host as the websocket,
 * which `useLobbyDoc` preloads before connecting — see the comment on that
 * endpoint for why the websocket sync alone cannot deliver a started game's
 * document.
 *
 * Pure and Vue-free so the mapping can be tested directly, including the
 * Discord Activity case where the "base" is a same-origin proxy path rather
 * than a bare origin.
 *
 * Returns null when the input cannot be parsed. Callers treat that as "no
 * preload available" and fall back to plain websocket sync, so this must never
 * throw into the connect path.
 */
export function teleportalHttpBase(wsUrl: string): string | null {
  try {
    const url = new URL(wsUrl);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    url.search = "";
    url.hash = "";
    const base = url.toString();
    return base.endsWith("/") ? base.slice(0, -1) : base;
  } catch {
    return null;
  }
}
