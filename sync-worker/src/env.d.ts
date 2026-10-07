// Bindings and secrets, merged into the Cloudflare.Env that partyserver,
// cloudflare:workers and cloudflare:test all type `env` with.
declare namespace Cloudflare {
  interface Env {
    LOBBY: DurableObjectNamespace<import("./lobbyRoom").LobbyRoom>;
    REGISTRY: DurableObjectNamespace<import("./registry").LobbyRegistry>;
    SYNC_ADMIN_TOKEN: string;
    WEB_APP_URL: string;
  }
}
interface Env extends Cloudflare.Env {}
