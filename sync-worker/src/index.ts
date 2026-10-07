// Worker entry. Routes the Teleportal HTTP contract the web app already
// speaks onto the lobby rooms and the registry:
//
//   WS   /parties/lobby/:code   → LobbyRoom(code)
//   GET  /snapshot/:code        → LobbyRoom(code), if the registry knows it
//   GET  /lobbies/summary       → registry (public, polled by the browser)
//   GET  /status                → registry (admin token)
//   POST /gc, DELETE /gc/:docId → registry → rooms (admin token)
//   GET  /health
//
// Rooms are addressed by hand rather than with routePartykitRequest, which
// would also expose the registry as /parties/registry/*.

import { getServerByName } from "partyserver";
import { corsHeaders, isAuthorized, json, safeDecode } from "./http";
import { isLobbyCode } from "./lobbyCode";
import { getRegistry } from "./registry";
import { reportError } from "./reporter";

export { LobbyRegistry } from "./registry";
export { LobbyRoom } from "./lobbyRoom";

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const cors = corsHeaders(request.headers.get("Origin"));
    try {
      return await route(request, env, cors);
    } catch (err) {
      ctx.waitUntil(reportError(env, err));
      return json({ error: "Internal error" }, 500, cors);
    }
  },
} satisfies ExportedHandler<Env>;

async function route(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (path === "/health") return json({ status: "ok", timestamp: Date.now() }, 200, cors);

  const room = /^\/parties\/lobby\/([^/]+)$/.exec(path);
  if (room) {
    const code = safeDecode(room[1]!);
    if (code === null || !isLobbyCode(code)) return json({ error: "Invalid lobby code" }, 400, cors);
    const stub = await getServerByName(env.LOBBY, code);
    return stub.fetch(request);
  }

  const snapshot = /^\/snapshot\/([^/]+)$/.exec(path);
  if (snapshot && method === "GET") {
    const decoded = safeDecode(snapshot[1]!);
    const code = decoded?.trim() ?? null;
    if (code === null || !isLobbyCode(code)) return json({ error: "Invalid lobby code" }, 400, cors);
    // Ask the registry first so junk codes never wake (or create) a room.
    if (!(await getRegistry(env).has(code))) {
      return json({ error: "No live document for that code" }, 404, cors);
    }
    const stub = await getServerByName(env.LOBBY, code);
    const res = await stub.fetch(new Request(`${url.origin}/snapshot`));
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  }

  if (path === "/lobbies/summary" && method === "GET") {
    return new Response(await getRegistry(env).summaryBody(), {
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const isAdminRoute = path === "/status" || path === "/gc" || path.startsWith("/gc/");
  if (isAdminRoute) {
    if (!isAuthorized(request, env.SYNC_ADMIN_TOKEN)) {
      return json({ error: "Unauthorized" }, 401, cors);
    }
    const registry = getRegistry(env);
    if (path === "/status" && method === "GET") {
      return new Response(await registry.statusBody(), {
        headers: { "Content-Type": "application/json", ...cors },
      });
    }
    if (path === "/gc" && method === "POST") {
      return json(await registry.gcAll(), 200, cors);
    }
    const single = /^\/gc\/(.+)$/.exec(path);
    if (single && method === "DELETE") {
      const docId = safeDecode(single[1]!);
      if (docId === null) {
        return json({ error: "Document not found", docId: single[1]! }, 404, cors);
      }
      const result = await registry.gcOne(docId);
      return json(result.body, result.status, cors);
    }
  }

  return json({ error: "Not found" }, 404, cors);
}
