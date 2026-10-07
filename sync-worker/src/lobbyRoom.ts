// One Durable Object per lobby code. Holds the lobby's Y.Doc and keeps a
// copy in DO storage, so a game survives deploys, restarts and hibernation.
//
// Lifecycle:
// - every change to the summary fields is pushed to LobbyRegistry (throttled)
// - while anyone is connected, an alarm runs every REAP_INTERVAL_MS and
//   closes sockets that stopped answering pings (a killed phone or a slept
//   laptop never sends a close frame, so without this the room would count
//   them as present until the platform noticed — possibly never)
// - when the last socket closes or is reaped, the doc is flushed and an
//   expiry deadline is stored EXPIRY_MS out; any new connection clears it
// - the alarm at that deadline wipes storage and the registry row
//
// A Durable Object has one alarm, so reaping and expiry share it; the
// stored deadline (EXPIRES_AT_KEY) says which job the next alarm is for.
//
// After a wipe the in-memory doc may outlive the storage until the runtime
// evicts this object. A player who reconnects in that window simply finds
// the game still there and the next save re-persists it — the same as
// returning a little earlier.

import type { Connection, ConnectionContext, WSMessage } from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";
import { extractLobbySummary } from "./extractLobbySummary";
import {
  createMessageGuard,
  MAX_MESSAGE_BYTES,
  MAX_SYNC_STEP2_BYTES,
  type MessageGuard,
} from "./messageGuard";
import { shouldPush } from "./pushPolicy";
import { getRegistry } from "./registry";
import { EXPIRY_MS } from "./registryViews";
import { reportError } from "./reporter";
import type { LobbyRecord } from "./types";

/** Storage key for the encoded doc: one value, overwritten on every save. */
export const DOC_KEY = "doc";
/** DO storage values cap at 2 MB; leave headroom. */
export const MAX_STORED_BYTES = 1.5 * 1024 * 1024;
/** Storage key for the expiry deadline (epoch ms); absent while anyone is connected. */
export const EXPIRES_AT_KEY = "expiresAt";
/** How often a room with connections checks them for liveness. */
export const REAP_INTERVAL_MS = 60_000;
/**
 * A socket whose last ping (or, if it never pinged, its connect) is older
 * than this is dead. Clients ping every 15 s, so this is four missed pings.
 */
export const STALE_SOCKET_MS = 60_000;
/** Close code sent to a reaped socket; a live client just reconnects. */
export const HEARTBEAT_TIMEOUT_CODE = 4000;
/**
 * Connection-state key for the connect time. Connection state is the
 * socket attachment, so it survives hibernation; y-partyserver keeps its
 * own key (__ypsAwarenessIds) beside it, and both writers spread the rest.
 */
export const CONNECTED_AT_KEY = "__unfitConnectedAt";
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
  #lastPushedActivity = 0;
  #pushTimer: ReturnType<typeof setTimeout> | null = null;
  #lastActivity = Date.now();
  #oversizeReported = false;
  // Set once purged or expired so the close events that follow neither
  // re-persist the doc nor arm a new alarm. Cleared by the next connection.
  #wiped = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Clients ping with the string "ping" so a half-open socket (sleep, NAT
    // timeout, Wi-Fi drop without a close frame) is noticed: y-partyserver's
    // provider has no receive timeout of its own. The runtime answers "pong"
    // itself, so a ping neither wakes a hibernated room nor reaches
    // onMessage and the message guard (it would count against the rate
    // limit). Set in the constructor, which runs on every wake, because the
    // pair must be in place before the first ping after a wake can arrive.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

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
    const now = this.now();
    this.#stampConnectedAt(connection, now);
    await this.ctx.storage.delete(EXPIRES_AT_KEY);
    // Someone is here, so the alarm's job is reaping. Never move an alarm
    // later: one due sooner than a reap would be is already good enough.
    const alarm = await this.ctx.storage.getAlarm();
    if (alarm === null || alarm > now + REAP_INTERVAL_MS) {
      await this.ctx.storage.setAlarm(now + REAP_INTERVAL_MS);
    }
    this.#schedulePush();
  }

  onMessage(connection: Connection, message: WSMessage): void {
    const size =
      typeof message === "string"
        ? new TextEncoder().encode(message).byteLength
        : message.byteLength;
    // Sync step 2 (messageSync = 0, step 2 = 1, both single-byte varuints)
    // is how a client re-supplies state the room lost, e.g. an oversize doc
    // after hibernation, so it may carry the whole diff. Everything else
    // keeps the tight cap, and the rate limit applies to both.
    const limit = this.#isSyncStep2(message) ? MAX_SYNC_STEP2_BYTES : MAX_MESSAGE_BYTES;
    const verdict = this.#guardFor(connection.id).check(size, Date.now(), limit);
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
      await this.#flush();
      await this.#armExpiry(this.now());
    }
    // The close events that follow a purge must not resurrect the row.
    if (!this.#wiped) this.#schedulePush();
  }

  async onAlarm(): Promise<void> {
    // A wipe deletes the alarm; this covers one already in flight.
    if (this.#wiped) return;
    const now = this.now();
    if (this.#reapStale(now) > 0) {
      await this.ctx.storage.delete(EXPIRES_AT_KEY);
      await this.ctx.storage.setAlarm(now + REAP_INTERVAL_MS);
      return;
    }
    const expiresAt = await this.ctx.storage.get<number>(EXPIRES_AT_KEY);
    if (expiresAt === undefined) {
      // The last socket was reaped, or its close event was lost: start the
      // expiry clock here, since onClose may never run for it.
      await this.#flush();
      await this.#armExpiry(now);
      this.#schedulePush();
      return;
    }
    if (now >= expiresAt) {
      await this.#wipe(this.name);
      return;
    }
    await this.ctx.storage.setAlarm(expiresAt);
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
    // A room whose close events were lost (a deploy or eviction dropped its
    // sockets without webSocketClose) may never have armed its expiry, so
    // its stored doc would outlive its registry row forever. A room that
    // still holds dead-but-open sockets is left to its own reaper alarm.
    if (this.openConnectionCount() === 0) await this.#armExpiry(this.now());
    this.#lastPushed = null;
    await this.#push(code);
    return true;
  }

  /** Clock for liveness and expiry; tests override it to skip ahead. */
  protected now(): number {
    return Date.now();
  }

  /**
   * When the runtime last answered this socket's "ping" (epoch ms), or null
   * if it never has. The auto-response never wakes the room, so this is the
   * only record that a hibernated client is still there. A Connection is
   * the hibernatable WebSocket itself, so it can be passed straight in.
   */
  protected lastPingAt(connection: Connection): number | null {
    try {
      return this.ctx.getWebSocketAutoResponseTimestamp(connection)?.getTime() ?? null;
    } catch {
      return null;
    }
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

  /**
   * Closes every open socket that has gone quiet for STALE_SOCKET_MS and
   * returns how many open sockets are left. Does the close bookkeeping
   * itself: a server-side close is not guaranteed to come back to this
   * object as webSocketClose, least of all from a peer that is gone.
   */
  #reapStale(now: number): number {
    let live = 0;
    let reaped = 0;
    for (const conn of this.getConnections()) {
      const lastSeen = this.#lastSeen(conn);
      if (lastSeen === null) {
        // No connect time recorded (accepted by an older build): start its
        // clock now rather than reap a socket we know nothing about.
        this.#stampConnectedAt(conn, now);
        live++;
        continue;
      }
      if (now - lastSeen <= STALE_SOCKET_MS) {
        live++;
        continue;
      }
      try {
        conn.close(HEARTBEAT_TIMEOUT_CODE, "Heartbeat timeout");
      } catch {
        // Already closing.
      }
      // YServer drops the socket's awareness states and tells the others.
      try {
        super.onClose(conn, HEARTBEAT_TIMEOUT_CODE, "Heartbeat timeout", false);
      } catch (err) {
        void reportError(this.env, err);
      }
      this.#guards.delete(conn.id);
      reaped++;
    }
    if (reaped > 0) this.#schedulePush();
    return live;
  }

  /** Latest sign of life: the last answered ping or the connect time. */
  #lastSeen(conn: Connection): number | null {
    const state = conn.state as Record<string, unknown> | null;
    const connectedAt = state?.[CONNECTED_AT_KEY];
    const times = [this.lastPingAt(conn), typeof connectedAt === "number" ? connectedAt : null];
    const known = times.filter((t): t is number => t !== null);
    return known.length > 0 ? Math.max(...known) : null;
  }

  /** Records the connect time in the socket attachment, beside y-partyserver's key. */
  #stampConnectedAt(conn: Connection, at: number): void {
    conn.setState((prev: unknown) => ({
      ...(prev && typeof prev === "object" ? prev : {}),
      [CONNECTED_AT_KEY]: at,
    }));
  }

  /**
   * The debounced save fires only on edits; flush so the final state is on
   * disk before the room goes quiet. A failed flush must not skip the
   * expiry, or the room would never clean up.
   */
  async #flush(): Promise<void> {
    try {
      await this.onSave();
    } catch (err) {
      await reportError(this.env, err);
    }
  }

  /**
   * Ensures an expiry deadline is stored and the alarm is set for it. Keeps
   * an existing deadline: a late close event for a socket the reaper already
   * counted out must not push the wipe back.
   */
  async #armExpiry(now: number): Promise<void> {
    let expiresAt = await this.ctx.storage.get<number>(EXPIRES_AT_KEY);
    if (expiresAt === undefined) {
      expiresAt = now + EXPIRY_MS;
      await this.ctx.storage.put(EXPIRES_AT_KEY, expiresAt);
    }
    await this.ctx.storage.setAlarm(expiresAt);
  }

  #isSyncStep2(message: WSMessage): boolean {
    if (typeof message === "string") return false;
    const bytes = ArrayBuffer.isView(message)
      ? new Uint8Array(message.buffer, message.byteOffset, Math.min(message.byteLength, 2))
      : new Uint8Array(message, 0, Math.min(message.byteLength, 2));
    return bytes.length === 2 && bytes[0] === 0 && bytes[1] === 1;
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
    // lastActivity changes on every edit; push when something the registry
    // shows has changed, or when the registry's copy has gone stale.
    const key = JSON.stringify({ ...record, lastActivity: 0 });
    if (!shouldPush(this.#lastPushed, this.#lastPushedActivity, key, record.lastActivity)) return;
    try {
      await getRegistry(this.env).upsert(record);
      this.#lastPushed = key;
      this.#lastPushedActivity = record.lastActivity;
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
    // Whether deleteAll also drops the alarm depends on the compatibility
    // date; a leftover reaper alarm must not wake the room for nothing.
    await this.ctx.storage.deleteAlarm();
    await getRegistry(this.env).remove(code);
  }
}
