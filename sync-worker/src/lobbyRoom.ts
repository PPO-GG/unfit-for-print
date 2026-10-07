// One Durable Object per lobby code. Holds the lobby's Y.Doc and keeps a
// copy in DO storage, so a game survives deploys, restarts and hibernation.
//
// Lifecycle:
// - every change to the summary fields is pushed to LobbyRegistry (throttled)
// - when the last socket closes, the doc is flushed and an alarm is set
//   EXPIRY_MS out; any new connection cancels it
// - the alarm wipes storage and the registry row
//
// After a wipe the in-memory doc may outlive the storage until the runtime
// evicts this object. A player who reconnects in that window simply finds
// the game still there and the next save re-persists it — the same as
// returning a little earlier.

import type { Connection, ConnectionContext, WSMessage } from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";
import { extractLobbySummary } from "./extractLobbySummary";
import { createMessageGuard, type MessageGuard } from "./messageGuard";
import { getRegistry } from "./registry";
import { EXPIRY_MS } from "./registryViews";
import { reportError } from "./reporter";
import type { LobbyRecord } from "./types";

/** Storage key for the encoded doc: one value, overwritten on every save. */
export const DOC_KEY = "doc";
/** DO storage values cap at 2 MB; leave headroom. */
export const MAX_STORED_BYTES = 1.5 * 1024 * 1024;
const PUSH_THROTTLE_MS = 1000;
const WS_OPEN = 1;

export class LobbyRoom extends YServer {
  // Idle games cost nothing while sockets stay open. Safe only because the
  // doc is reloaded from storage (onLoad) every time the room wakes.
  static options = { hibernate: true };

  static callbackOptions = {
    debounceWait: 2000,
    debounceMaxWait: 10_000,
    timeout: 5000,
  };

  #guards = new Map<string, MessageGuard>();
  #lastPushed: string | null = null;
  #pushTimer: ReturnType<typeof setTimeout> | null = null;
  #lastActivity = Date.now();
  #oversizeReported = false;
  // Set once purged or expired so the close events that follow neither
  // re-persist the doc nor arm a new alarm. Cleared by the next connection.
  #wiped = false;

  async onLoad(): Promise<void> {
    const stored = await this.ctx.storage.get<Uint8Array>(DOC_KEY);
    if (stored) Y.applyUpdate(this.document, stored);
    this.document.on("update", () => this.#schedulePush());
  }

  async onSave(): Promise<void> {
    if (this.#wiped) return;
    const state = Y.encodeStateAsUpdate(this.document);
    if (state.byteLength > MAX_STORED_BYTES) {
      if (!this.#oversizeReported) {
        this.#oversizeReported = true;
        await reportError(
          this.env,
          new Error(`Lobby ${this.name} doc is ${state.byteLength} bytes; not persisted`),
        );
      }
      return;
    }
    await this.ctx.storage.put(DOC_KEY, state);
  }

  async onConnect(connection: Connection, ctx: ConnectionContext): Promise<void> {
    super.onConnect(connection, ctx);
    this.#wiped = false;
    await this.ctx.storage.deleteAlarm();
    this.#schedulePush();
  }

  onMessage(connection: Connection, message: WSMessage): void {
    const size = typeof message === "string" ? message.length : message.byteLength;
    const verdict = this.#guardFor(connection.id).check(size, Date.now());
    if (verdict === "too-large") {
      connection.close(1009, "Message too large");
      return;
    }
    if (verdict === "rate-limited") {
      connection.close(1008, "Rate limit exceeded");
      return;
    }
    super.onMessage(connection, message);
  }

  async onClose(
    connection: Connection,
    code: number,
    reason: string,
    wasClean: boolean,
  ): Promise<void> {
    super.onClose(connection, code, reason, wasClean);
    this.#guards.delete(connection.id);
    if (!this.#wiped && this.openConnectionCount(connection) === 0) {
      // The debounced save fires only on edits; flush now so the final
      // state is on disk before the room goes quiet. A failed flush must
      // not skip the expiry alarm, or the room would never clean up.
      try {
        await this.onSave();
      } catch (err) {
        await reportError(this.env, err);
      }
      await this.ctx.storage.setAlarm(Date.now() + EXPIRY_MS);
    }
    // The close events that follow a purge must not resurrect the row.
    if (!this.#wiped) this.#schedulePush();
  }

  async onAlarm(): Promise<void> {
    if (this.openConnectionCount() > 0) return;
    await this.#wipe(this.name);
  }

  onException(error: unknown): void {
    void reportError(this.env, error);
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/snapshot") {
      // An empty state vector is a single zero byte: nothing to preload.
      if (Y.encodeStateVector(this.document).byteLength <= 1) {
        return Response.json({ error: "No live document for that code" }, { status: 404 });
      }
      return new Response(Y.encodeStateAsUpdateV2(this.document), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Cache-Control": "no-store",
        },
      });
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  /** Admin GC: drop every player and forget the lobby. */
  async purge(code: string): Promise<void> {
    for (const conn of this.getConnections()) {
      try {
        conn.close(1000, "Lobby removed by admin");
      } catch {
        // Already closing.
      }
    }
    await this.#wipe(code);
  }

  /**
   * Registry drift repair. Returns false when this room holds nothing — no
   * stored doc and nobody connected — so the registry can drop its row.
   */
  async refresh(code: string): Promise<boolean> {
    const stored = await this.ctx.storage.get<Uint8Array>(DOC_KEY);
    if (!stored && this.openConnectionCount() === 0) {
      // Clears anything partyserver wrote while waking us for this call.
      await this.ctx.storage.deleteAll();
      return false;
    }
    this.#lastPushed = null;
    await this.#push(code);
    return true;
  }

  /** Open sockets, not counting `excluding` (the one closing right now). */
  protected openConnectionCount(excluding?: Connection): number {
    let count = 0;
    for (const conn of this.getConnections()) {
      if (excluding && conn.id === excluding.id) continue;
      if (conn.readyState === WS_OPEN) count++;
    }
    return count;
  }

  #guardFor(connectionId: string): MessageGuard {
    let guard = this.#guards.get(connectionId);
    if (!guard) {
      guard = createMessageGuard();
      this.#guards.set(connectionId, guard);
    }
    return guard;
  }

  #schedulePush(): void {
    this.#lastActivity = Date.now();
    if (this.#pushTimer) return;
    this.#pushTimer = setTimeout(() => {
      this.#pushTimer = null;
      void this.#push(this.name);
    }, PUSH_THROTTLE_MS);
  }

  async #push(code: string): Promise<void> {
    if (this.#wiped) return;
    const record: LobbyRecord = {
      ...extractLobbySummary(this.document),
      code,
      clients: this.openConnectionCount(),
      lastActivity: this.#lastActivity,
    };
    // lastActivity changes on every edit; only push when something the
    // registry shows has changed.
    const key = JSON.stringify({ ...record, lastActivity: 0 });
    if (key === this.#lastPushed) return;
    try {
      await getRegistry(this.env).upsert(record);
      this.#lastPushed = key;
    } catch (err) {
      // Never let the registry affect sync. The next change pushes again and
      // the registry's hourly sweep covers anything missed.
      console.error(`[sync] registry push failed for ${code}:`, err);
    }
  }

  async #wipe(code: string): Promise<void> {
    this.#wiped = true;
    if (this.#pushTimer) {
      clearTimeout(this.#pushTimer);
      this.#pushTimer = null;
    }
    this.#lastPushed = null;
    await this.ctx.storage.deleteAll();
    await getRegistry(this.env).remove(code);
  }
}
