// composables/useLobbyDoc.ts
// Y.Doc factory and Teleportal provider for ephemeral game lobbies.
//
// Creates a single Y.Doc per lobby, synced via Teleportal WebSocket.
// No persistence — the doc is purely in-memory because lobbies are ephemeral.
//
// Usage:
//   const { doc, connect, disconnect, awareness, synced, connected } = useLobbyDoc()
//   await connect(lobbyCode, token)
//   // ... game plays ...
//   disconnect()

import * as Y from "yjs";
import { ref, shallowRef, readonly, type Ref, type ShallowRef } from "vue";
import { Provider, websocket } from "teleportal/providers";

const { WebSocketConnection } = websocket;

// ─── Y.Doc Map Keys ─────────────────────────────────────────────────────────
// Centralized constants for all shared type names within the lobby Y.Doc.
// Every composable that reads/writes the doc should import these.
export const DOC_KEYS = {
  META: "meta",
  SETTINGS: "settings",
  GAME_STATE: "gameState",
  CARDS: "cards",
  HANDS: "hands",
  PLAYERS: "players",
  CHAT: "chat",
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LobbyDocResult {
  /** The raw Y.Doc instance — for advanced usage and direct observation */
  doc: ShallowRef<Y.Doc | null>;

  /** Connect to a lobby Y.Doc via Teleportal */
  connect: (lobbyCode: string, token?: string) => Promise<void>;

  /** Disconnect and destroy the provider + doc */
  disconnect: () => void;

  /** Yjs Awareness instance for presence (userId, name, avatar, isReady, etc.) */
  awareness: ShallowRef<any | null>;

  /** Resolves when the server sync is complete */
  synced: Ref<boolean>;

  /** Whether the WebSocket is currently connected */
  connected: Ref<boolean>;

  /** Current lobby code (null if not connected) */
  lobbyCode: Ref<string | null>;

  // ── Typed Y.Doc Accessors ──────────────────────────────────────────────
  // Convenience getters that return the correct shared type from the doc.
  // These are safe to call at any time — they return a fresh reference
  // each time, tied to the current doc instance.

  /** Y.Map("meta") — lobby code, hostUserId, status, createdAt */
  getMeta: () => Y.Map<any>;
  /** Y.Map("settings") — maxPoints, cardsPerPlayer, cardPacks, etc. */
  getSettings: () => Y.Map<any>;
  /** Y.Map("gameState") — phase, round, judgeId, submissions, scores, etc. */
  getGameState: () => Y.Map<any>;
  /** Y.Map("cards") — whiteDeck, blackDeck, discardWhite, discardBlack, cardTexts */
  getCards: () => Y.Map<any>;
  /** Y.Map("hands") — playerId → CardId[] (JSON strings) */
  getHands: () => Y.Map<any>;
  /** Y.Map("players") — playerId → player data (JSON strings) */
  getPlayers: () => Y.Map<any>;
  /** Y.Array("chat") — ordered message list (JSON strings) */
  getChat: () => Y.Array<string>;
}

// ─── Module-level Singleton ─────────────────────────────────────────────────
// Only one lobby doc can be active at a time — the player can only be in one game.
// This mirrors the existing "one active lobby per user" constraint in useLobby.ts.
//
// IMPORTANT: The reactive refs MUST be module-level so that all useLobbyDoc()
// instances share the same reactive state. If refs were created inside the
// function, connect() in one instance wouldn't trigger watchers in another
// (e.g., useLobbyReactive's observers would never fire).
//
// HMR guard: During development, Vite re-executes this module on hot reload,
// which would orphan the live WebSocket and Y.Doc. We stash the active state
// on import.meta.hot.data so it survives module re-evaluation.
// The mutable state (activeDoc, etc.) lives in a single object so that
// reassignments inside connect()/disconnect() are visible to the HMR stash.

interface LobbyDocState {
  activeDoc: Y.Doc | null;
  activeProvider: any | null;
  activeConnection: any | null;
  beforeUnloadHandler: (() => void) | null;
  doc: ShallowRef<Y.Doc | null>;
  awareness: ShallowRef<any | null>;
  synced: Ref<boolean>;
  connected: Ref<boolean>;
  lobbyCode: Ref<string | null>;
}

const _prev: LobbyDocState | undefined = import.meta.hot?.data?.lobbyDoc;

const _state: LobbyDocState = _prev ?? {
  activeDoc: null,
  activeProvider: null,
  activeConnection: null,
  beforeUnloadHandler: null,
  doc: shallowRef<Y.Doc | null>(null),
  awareness: shallowRef<any | null>(null),
  synced: ref(false),
  connected: ref(false),
  lobbyCode: ref<string | null>(null),
};

// Stash state for next HMR reload — same object reference, so mutations
// inside connect()/disconnect() are automatically reflected.
if (import.meta.hot) {
  import.meta.hot.data.lobbyDoc = _state;
  import.meta.hot.accept();
}

// Convenience aliases so the rest of the file stays readable
const doc = _state.doc;
const awareness = _state.awareness;
const synced = _state.synced;
const connected = _state.connected;
const lobbyCode = _state.lobbyCode;

export function useLobbyDoc(): LobbyDocResult {
  const config = useRuntimeConfig();

  // ── Typed Accessors ────────────────────────────────────────────────────

  const requireDoc = (): Y.Doc => {
    if (!doc.value)
      throw new Error("[LobbyDoc] No active Y.Doc — call connect() first");
    return doc.value;
  };

  const getMeta = () => requireDoc().getMap(DOC_KEYS.META);
  const getSettings = () => requireDoc().getMap(DOC_KEYS.SETTINGS);
  const getGameState = () => requireDoc().getMap(DOC_KEYS.GAME_STATE);
  const getCards = () => requireDoc().getMap(DOC_KEYS.CARDS);
  const getHands = () => requireDoc().getMap(DOC_KEYS.HANDS);
  const getPlayers = () => requireDoc().getMap(DOC_KEYS.PLAYERS);
  const getChat = () => requireDoc().getArray<string>(DOC_KEYS.CHAT);

  // ── Connect ────────────────────────────────────────────────────────────

  const connect = async (code: string, token?: string): Promise<void> => {
    // Tear down any existing connection first
    disconnect();

    const documentName = `lobby-${code}`;
    const ydoc = new Y.Doc();

    // Build WebSocket URL
    // NOTE: Do NOT set ?document= in the URL. The Teleportal Provider handles
    // document identification via its own sync protocol (the `document` field
    // in Provider.create). Sending it in both places causes the server to
    // create a duplicate Y.Doc under a namespaced key (e.g., lobby-CODE/lobby-CODE),
    // which gets orphaned and triggers GC sweeps that corrupt tracking state.
    //
    // Discord Activity: the iframe on discordsays.com blocks direct external
    // WebSocket connections. Route through Discord's proxy via URL mapping
    // (/teleportal → teleportal.unfit.cards, configured in Developer Portal).
    const { isDiscordActivity } = useDiscordSDK();
    let baseUrl: string;
    if (isDiscordActivity.value && typeof window !== "undefined") {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      baseUrl = `${proto}//${window.location.host}/teleportal`;
    } else {
      baseUrl = config.public.lobbyTeleportalUrl || "ws://localhost:1235";
    }
    console.log(
      `[LobbyDoc] Connecting to ${baseUrl} doc=${documentName}${isDiscordActivity.value ? " (Discord proxy)" : ""}`,
    );
    const wsUrl = new URL(baseUrl);
    if (token) {
      wsUrl.searchParams.set("token", token);
    }

    // Yield to event loop before heavy Provider.create()
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Create WebSocket-only connection — the Teleportal server only supports
    // WebSocket transport, so using FallbackConnection would just produce
    // noisy 404 errors when it tries the HTTP/SSE fallback on brief disconnects.
    const connection = new WebSocketConnection({
      url: wsUrl.toString(),
      heartbeatInterval: 15_000, // Ping every 15s to keep alive
      messageReconnectTimeout: 60_000, // 60s timeout (more generous than Rundown's 45s — games have idle phases)
    });

    const provider = await Provider.create({
      connection,
      document: documentName,
      ydoc,
      enableOfflinePersistence: false, // Ephemeral — no IndexedDB
    });

    // Store module-level refs for singleton enforcement
    _state.activeDoc = ydoc;
    _state.activeProvider = provider;
    _state.activeConnection = connection;

    // Expose to composable consumers
    doc.value = ydoc;
    awareness.value = provider.awareness;
    lobbyCode.value = code;
    connected.value = true;

    // Register beforeunload — ensures a clean WebSocket close on
    // page refresh / tab close so the server can immediately GC.
    if (typeof window !== "undefined") {
      // Remove any previous handler first (shouldn't happen, but be safe)
      if (_state.beforeUnloadHandler) {
        window.removeEventListener("beforeunload", _state.beforeUnloadHandler);
      }
      _state.beforeUnloadHandler = () => {
        disconnect();
      };
      window.addEventListener("beforeunload", _state.beforeUnloadHandler);
    }

    // Wait for initial sync before resolving — callers need the full Y.Doc
    // state (especially the players map) to be available immediately.
    // Timeout after 5s to avoid hanging if the server is slow.
    try {
      await Promise.race([
        provider.synced,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("sync timeout")), 5000),
        ),
      ]);
      synced.value = true;
      console.log(`[LobbyDoc] Synced with server for lobby-${code}`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("destroyed")) return;
      if (msg.includes("sync timeout")) {
        console.warn(
          `[LobbyDoc] Sync timed out for lobby-${code} — proceeding with partial state`,
        );
        synced.value = false;
      } else {
        console.error(`[LobbyDoc] Sync failed for lobby-${code}:`, err);
      }
    }
  };

  // ── Disconnect ─────────────────────────────────────────────────────────

  const disconnect = () => {
    // Remove beforeunload listener to avoid double-teardown
    if (typeof window !== "undefined" && _state.beforeUnloadHandler) {
      window.removeEventListener("beforeunload", _state.beforeUnloadHandler);
      _state.beforeUnloadHandler = null;
    }

    if (_state.activeProvider) {
      try {
        _state.activeProvider.destroy?.();
      } catch {
        // Best-effort cleanup
      }
      _state.activeProvider = null;
    }
    if (_state.activeConnection) {
      try {
        _state.activeConnection.destroy?.();
      } catch {
        // Best-effort cleanup
      }
      _state.activeConnection = null;
    }
    if (_state.activeDoc) {
      _state.activeDoc.destroy();
      _state.activeDoc = null;
    }

    doc.value = null;
    awareness.value = null;
    synced.value = false;
    connected.value = false;
    lobbyCode.value = null;
  };

  return {
    doc,
    connect,
    disconnect,
    awareness,
    synced: readonly(synced),
    connected: readonly(connected),
    lobbyCode: readonly(lobbyCode),
    getMeta,
    getSettings,
    getGameState,
    getCards,
    getHands,
    getPlayers,
    getChat,
  };
}
