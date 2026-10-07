import { getServerByName } from "partyserver";
import { isLobbyCode } from "./lobbyCode";

export { LobbyRoom } from "./lobbyRoom";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", timestamp: Date.now() });
    }

    const room = /^\/parties\/lobby\/([^/]+)$/.exec(url.pathname);
    if (room) {
      const code = decodeURIComponent(room[1]!);
      if (!isLobbyCode(code)) {
        return Response.json({ error: "Invalid lobby code" }, { status: 400 });
      }
      const stub = await getServerByName(env.LOBBY, code);
      return stub.fetch(request);
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
