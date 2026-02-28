// src/server.ts
// Ephemeral Teleportal server for Unfit for Print game lobbies.
//
// ARCHITECTURE:
// - NO persistence — all Y.Docs live in memory only
// - NO storage backend — no R2, no Appwrite, no IndexedDB
// - NO auth required — lobby access = knowing the code
// - Automatic GC — docs are destroyed when the last client disconnects
// - Lightweight — stripped to just the Yjs sync engine

import { Server } from "teleportal/server";
import { getWebsocketHandlers } from "teleportal/websocket-server";
import { getHTTPHandlers } from "teleportal/http";
import { YDocStorage } from "teleportal/storage";
import { createServer } from "http";
import crossws from "crossws/adapters/node";
import { config } from "dotenv";

config();

// ─── Configuration ──────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "1235", 10);
const DEBUG = process.env.DEBUG === "true";

const ALLOWED_ORIGINS = new Set([
  "https://unfit.cards",
  "http://localhost:3000",
  "http://localhost:3001",
]);

// ─── Global Error Handlers ──────────────────────────────────────────────────

process.on("uncaughtException", (error) => {
  console.error("[Lobby] UNCAUGHT EXCEPTION:", error.message);
  console.error("[Lobby] Stack:", error.stack);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Lobby] UNHANDLED REJECTION:", reason);
});

// ─── Session Tracking ───────────────────────────────────────────────────────

interface ClientInfo {
  clientId: string;
  connectedAt: number;
  documentId?: string;
}

const activeClients = new Map<string, ClientInfo>();
const documentClientCount = new Map<string, number>();
const documentLastActivity = new Map<string, number>();

/** How long (ms) a zero-client document can exist before being force-GC'd */
const IDLE_DOC_TTL = 60 * 1000; // 60 seconds — only applies to docs with 0 clients

function trackClientJoinDoc(clientId: string, namespacedDocId: string) {
  const info = activeClients.get(clientId);
  if (info) info.documentId = namespacedDocId;

  const count = (documentClientCount.get(namespacedDocId) || 0) + 1;
  documentClientCount.set(namespacedDocId, count);
  documentLastActivity.set(namespacedDocId, Date.now());
  console.log(`[Lobby] ${namespacedDocId}: ${count} client(s) connected`);
}

function trackClientLeaveDoc(clientId: string) {
  const info = activeClients.get(clientId);
  if (!info?.documentId) return;

  const namespacedDocId = info.documentId;
  const count = Math.max(
    0,
    (documentClientCount.get(namespacedDocId) || 1) - 1,
  );
  documentLastActivity.set(namespacedDocId, Date.now());

  if (count === 0) {
    // Don't delete tracking immediately — let the GC sweep handle it
    // after IDLE_DOC_TTL so the doc persists through brief disconnects.
    documentClientCount.set(namespacedDocId, 0);
    console.log(
      `[Lobby] ${namespacedDocId}: last client left — will GC after ${IDLE_DOC_TTL / 1000}s idle`,
    );
  } else {
    documentClientCount.set(namespacedDocId, count);
    console.log(`[Lobby] ${namespacedDocId}: ${count} client(s) remaining`);
  }
}

/**
 * Force-GC a single document: remove tracking state, delete the Y.Doc,
 * and clean up any client entries that reference it.
 */
function forceGcDocument(docId: string) {
  documentClientCount.delete(docId);
  documentLastActivity.delete(docId);
  documentStorage.deleteDocument(docId).catch((e: any) => {
    console.error(`[Lobby] GC: failed to delete ${docId}:`, e.message);
  });
  // Clean up client entries for this doc
  for (const [clientId, info] of activeClients) {
    if (info.documentId === docId) {
      activeClients.delete(clientId);
    }
  }
}

/**
 * Read Y.Doc contents for a lobby and extract player information.
 * Returns structured data for the admin status endpoint.
 */
function getDocumentDetails(docId: string): {
  clients: number;
  idleSec: number;
  players: Array<{
    id: string;
    name: string;
    avatar?: string;
    isBot?: boolean;
  }>;
  meta: Record<string, any>;
  phase?: string;
} {
  const now = Date.now();
  const clients = documentClientCount.get(docId) || 0;
  const lastActivity = documentLastActivity.get(docId) || now;
  const idleSec = Math.round((now - lastActivity) / 1000);

  // Try to read from the Y.Doc in memory
  const players: Array<{
    id: string;
    name: string;
    avatar?: string;
    isBot?: boolean;
  }> = [];
  let meta: Record<string, any> = {};
  let phase: string | undefined;

  const ydoc = YDocStorage.docs.get(docId);
  if (ydoc) {
    // Read players from Y.Map("players")
    try {
      const playersMap = ydoc.getMap("players");
      playersMap.forEach((value: any, key: string) => {
        try {
          const data = typeof value === "string" ? JSON.parse(value) : value;
          players.push({
            id: key,
            name: data?.name || data?.displayName || "Unknown",
            avatar: data?.avatar || data?.avatarUrl || undefined,
            isBot: data?.isBot || false,
          });
        } catch {
          players.push({ id: key, name: "Unknown" });
        }
      });
    } catch {
      // Players map may not exist yet
    }

    // Read meta from Y.Map("meta")
    try {
      const metaMap = ydoc.getMap("meta");
      metaMap.forEach((value: any, key: string) => {
        meta[key] = value;
      });
    } catch {
      // Meta map may not exist yet
    }

    // Read game phase from Y.Map("gameState")
    try {
      const gameStateMap = ydoc.getMap("gameState");
      phase = gameStateMap.get("phase") as string | undefined;
    } catch {
      // Game state may not exist yet
    }
  }

  return { clients, idleSec, players, meta, phase };
}

// Periodic sweep: remove stale clients (connected but never joined a doc)
setInterval(() => {
  const now = Date.now();
  let swept = 0;
  for (const [clientId, entry] of activeClients) {
    if (now - entry.connectedAt > 5 * 60 * 1000 && !entry.documentId) {
      activeClients.delete(clientId);
      swept++;
    }
  }
  if (swept > 0) {
    console.log(
      `[Lobby] Swept ${swept} stale clients (remaining: ${activeClients.size})`,
    );
  }
}, 60_000);

// Periodic sweep: GC orphaned documents (safety net against tracking drift)
// ONLY GC documents with 0 connected clients that have been idle > IDLE_DOC_TTL.
// Documents with active clients are NEVER garbage-collected regardless of idle time.
setInterval(() => {
  const now = Date.now();
  let gcCount = 0;
  for (const [docId, count] of documentClientCount) {
    // Never GC a document that has active clients
    if (count > 0) continue;

    const lastActivity = documentLastActivity.get(docId) || 0;
    const idleMs = now - lastActivity;

    if (idleMs > IDLE_DOC_TTL) {
      console.log(
        `[Lobby] GC sweep: ${docId} (0 clients, idle ${Math.round(idleMs / 1000)}s)`,
      );
      forceGcDocument(docId);
      gcCount++;
    }
  }

  // Also sweep Y.Docs in storage that are NOT tracked in documentClientCount
  // (defensive: catches docs orphaned by bugs in tracking)
  for (const docId of YDocStorage.docs.keys()) {
    if (!documentClientCount.has(docId)) {
      console.log(
        `[Lobby] GC sweep: orphaned Y.Doc ${docId} (not in tracking map)`,
      );
      forceGcDocument(docId);
      gcCount++;
    }
  }

  if (gcCount > 0) {
    console.log(
      `[Lobby] GC sweep: cleaned up ${gcCount} document(s) (${activeClients.size} clients remain)`,
    );
  }
}, 30_000);

// ─── Context Type (must satisfy ServerContext: { clientId, userId }) ─────────

interface LobbyContext {
  clientId: string;
  userId: string; // Required by Teleportal's ServerContext
  room: string;
}

// ─── Teleportal Server ──────────────────────────────────────────────────────

// YDocStorage is an in-memory Y.Doc store from Teleportal.
// Docs live only in memory — no persistence to disk/cloud.
const documentStorage = new YDocStorage();

const teleportalServer = new Server<LobbyContext>({
  storage: documentStorage,
  checkPermission: async () => true,

  rateLimitConfig: {
    rules: [
      {
        id: "per-user",
        maxMessages: 200,
        windowMs: 1000,
        trackBy: "user" as const,
      },
      {
        id: "per-document",
        maxMessages: 1000,
        windowMs: 10_000,
        trackBy: "document" as const,
      },
    ],
    maxMessageSize: 1 * 1024 * 1024,
    onRateLimitExceeded: (details: any) => {
      console.warn("[RateLimit] Exceeded:", details);
    },
  },
});

// ─── Event Listeners ────────────────────────────────────────────────────────

teleportalServer.on("session-open", ({ session }) => {
  console.log(
    `[Lobby] Session opened: ${session.documentId} (namespaced: ${session.namespacedDocumentId})`,
  );

  // IMPORTANT: Use namespacedDocumentId for all tracking because YDocStorage
  // stores docs under the namespaced key (e.g., "lobby/lobby-CODE").
  // Using the un-namespaced documentId would cause a tracking/storage mismatch,
  // making the GC sweep treat active docs as orphaned.
  session.on("client-join", ({ clientId }: { clientId: string }) => {
    trackClientJoinDoc(clientId, session.namespacedDocumentId);
  });

  session.on("client-leave", ({ clientId }: { clientId: string }) => {
    trackClientLeaveDoc(clientId);
  });
});

// GC: Teleportal fires "document-unload" when a session is disposed
// (all clients disconnected + cleanup delay). This is our primary GC trigger.
teleportalServer.on(
  "document-unload",
  ({ documentId, namespacedDocumentId, reason }) => {
    console.log(
      `[Lobby] Document unloaded: ${namespacedDocumentId} (reason: ${reason})`,
    );
    // Clean tracking maps using namespaced ID (matches YDocStorage keys)
    documentClientCount.delete(namespacedDocumentId);
    documentLastActivity.delete(namespacedDocumentId);
    // Also clean un-namespaced ID defensively (in case of legacy entries)
    documentClientCount.delete(documentId);
    documentLastActivity.delete(documentId);
    // Remove from YDocStorage defensively
    documentStorage.deleteDocument(namespacedDocumentId).catch((e: any) => {
      console.error(
        `[Lobby] GC cleanup failed for ${namespacedDocumentId}:`,
        e.message,
      );
    });
    // Clean up client entries referencing this doc
    for (const [clientId, info] of activeClients) {
      if (
        info.documentId === namespacedDocumentId ||
        info.documentId === documentId
      ) {
        activeClients.delete(clientId);
      }
    }
  },
);

if (DEBUG) {
  (teleportalServer as any).on("client-message", (data: any) => {
    const msg = data.message;
    console.log(
      `[Message] ${data.direction} - ${msg?.type || "unknown"} (doc: ${msg?.document})`,
    );
  });
}

// ─── WebSocket Handlers ─────────────────────────────────────────────────────

const wsHandlers = getWebsocketHandlers({
  server: teleportalServer,
  onUpgrade: async (request: Request) => {
    const url = new URL(request.url);
    // NOTE: The ?document= param is no longer sent by the client.
    // Document identification is handled by the Teleportal Provider's
    // sync protocol. The session-open / client-join events provide
    // the actual documentId after the sync handshake completes.
    const documentHint = url.searchParams.get("document");

    const clientId = Math.random().toString(36).substring(2, 10);
    console.log(
      `[WS Upgrade] Client ${clientId}${documentHint ? ` → ${documentHint}` : ""}`,
    );

    activeClients.set(clientId, {
      clientId,
      connectedAt: Date.now(),
      // Don't pre-assign documentId — let session events handle it
      documentId: undefined,
    });

    return {
      context: {
        clientId,
        userId: `anon-${clientId}`, // Lobby players are anonymous to the sync server
        // Static namespace — Teleportal uses this as a prefix for the
        // namespaced document ID ("lobby/lobby-CODE"). Using a static
        // value prevents the old bug where setting room to the document
        // name created duplicate entries like "lobby-CODE/lobby-CODE".
        room: "lobby",
      },
    };
  },
  onConnect: (ctx: { context: LobbyContext }) => {
    if (DEBUG) console.log(`[WS Connect] ${ctx.context?.clientId}`);
  },
  onDisconnect: (ctx: { context: LobbyContext }) => {
    const clientId = ctx.context?.clientId;
    if (clientId) {
      const info = activeClients.get(clientId);
      console.log(
        `[WS Disconnect] Client ${clientId} ← ${info?.documentId || "unknown"}`,
      );
      trackClientLeaveDoc(clientId);
      activeClients.delete(clientId);
    }
  },
});

// ─── HTTP Handler (SSE fallback — single function, not object) ──────────────

const httpHandler = getHTTPHandlers({
  server: teleportalServer,
  getContext: async (request: Request) => {
    const url = new URL(request.url);
    const documentId = url.searchParams.get("document");

    return {
      userId: `anon-http-${Date.now()}`,
      room: documentId || "default",
    };
  },
});

// ─── crossws Adapter ────────────────────────────────────────────────────────

const ws = crossws({
  hooks: wsHandlers,
});

// ─── CORS Headers ───────────────────────────────────────────────────────────

function getCorsHeaders(req?: any): Record<string, string> {
  const origin = req?.headers?.origin;
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.has(origin)
      ? origin
      : process.env.NODE_ENV === "production"
        ? "https://unfit.cards"
        : "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Powered-By, Cache-Control, Accept, Origin, X-Teleportal-Client-Id",
    "Access-Control-Max-Age": "86400",
  };
}

// ─── HTTP Server ────────────────────────────────────────────────────────────

const httpServer = createServer(async (req, res) => {
  const url = `http://${req.headers.host}${req.url}`;
  const urlPath = new URL(url).pathname;
  const corsHeaders = getCorsHeaders(req);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // Health check
  if (urlPath === "/health") {
    res.writeHead(200, { "Content-Type": "application/json", ...corsHeaders });
    res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
    return;
  }

  // Status endpoint — enriched with player data from Y.Docs
  if (urlPath === "/status") {
    const now = Date.now();

    // Collect all known doc IDs from both tracking maps AND YDocStorage
    const allDocIds = new Set([
      ...documentClientCount.keys(),
      ...YDocStorage.docs.keys(),
    ]);

    const docs: Record<string, ReturnType<typeof getDocumentDetails>> = {};
    for (const docId of allDocIds) {
      docs[docId] = getDocumentDetails(docId);
    }

    res.writeHead(200, { "Content-Type": "application/json", ...corsHeaders });
    res.end(
      JSON.stringify({
        version: "1.2.0-ephemeral",
        uptime: process.uptime(),
        activeClients: activeClients.size,
        activeDocuments: allDocIds.size,
        idleDocTtlSec: IDLE_DOC_TTL / 1000,
        documents: docs,
        memoryUsage: {
          rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB`,
          heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`,
        },
        timestamp: now,
      }),
    );
    return;
  }

  // Force GC ALL documents
  if (urlPath === "/gc" && req.method === "POST") {
    let gcCount = 0;
    // Collect all doc IDs first to avoid mutation during iteration
    const allDocIds = new Set([
      ...documentClientCount.keys(),
      ...YDocStorage.docs.keys(),
    ]);
    for (const docId of allDocIds) {
      forceGcDocument(docId);
      gcCount++;
    }
    console.log(`[Lobby] Manual GC: flushed ${gcCount} document(s)`);
    res.writeHead(200, { "Content-Type": "application/json", ...corsHeaders });
    res.end(
      JSON.stringify({ flushed: gcCount, remaining: activeClients.size }),
    );
    return;
  }

  // Force GC a SINGLE document: DELETE /gc/:docId
  const singleGcMatch = urlPath.match(/^\/gc\/(.+)$/);
  if (singleGcMatch && req.method === "DELETE") {
    const docId = decodeURIComponent(singleGcMatch[1]);
    const existed =
      documentClientCount.has(docId) || YDocStorage.docs.has(docId);

    if (existed) {
      forceGcDocument(docId);
      console.log(`[Lobby] Manual GC: force-removed ${docId}`);
      res.writeHead(200, {
        "Content-Type": "application/json",
        ...corsHeaders,
      });
      res.end(
        JSON.stringify({
          removed: docId,
          remaining: activeClients.size,
        }),
      );
    } else {
      res.writeHead(404, {
        "Content-Type": "application/json",
        ...corsHeaders,
      });
      res.end(JSON.stringify({ error: "Document not found", docId }));
    }
    return;
  }

  // Delegate SSE, /send, /message, etc. to Teleportal's HTTP handler
  // getHTTPHandlers returns a single function that handles all HTTP routes:
  // GET /sse, POST /sse, POST /message, GET /health, GET /metrics, GET /status
  try {
    // Build a standard Request from the Node.js IncomingMessage
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers[key] = Array.isArray(value) ? value[0]! : value;
    }

    let body: string | undefined;
    if (req.method === "POST") {
      body = await new Promise<string>((resolve) => {
        let data = "";
        req.on("data", (chunk: any) => {
          data += chunk;
        });
        req.on("end", () => resolve(data));
      });
    }

    const request = new Request(url, {
      method: req.method || "GET",
      headers,
      ...(body ? { body } : {}),
    });

    const response = await httpHandler(request);

    // Stream the response back
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
    };
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    res.writeHead(response.status, responseHeaders);

    if (response.body) {
      const reader = (response.body as ReadableStream).getReader();
      const pump = async () => {
        try {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          }
          res.write(value);
          pump();
        } catch {
          res.end();
        }
      };
      pump();
    } else {
      res.end(await response.text());
    }
  } catch (err: any) {
    // If Teleportal's handler doesn't match, return 404
    if (res.headersSent) return;
    res.writeHead(404, corsHeaders);
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

// Handle WebSocket upgrades
httpServer.on("upgrade", (req, socket, head) => {
  ws.handleUpgrade(req, socket, head);
});

// ─── Start ──────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log("");
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  Unfit for Print — Lobby Teleportal Server       ║");
  console.log("║  Mode: EPHEMERAL (no persistence)                ║");
  console.log(`║  Port: ${String(PORT).padEnd(42)}║`);
  console.log(`║  Debug: ${String(DEBUG).padEnd(41)}║`);
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("");
});
