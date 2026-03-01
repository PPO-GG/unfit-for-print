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
import { Provider, FallbackConnection } from "teleportal/providers";

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
let activeDoc: Y.Doc | null = null;
let activeProvider: any | null = null;
let activeConnection: any | null = null;
let beforeUnloadHandler: (() => void) | null = null;

const doc = shallowRef<Y.Doc | null>(null);
const awareness = shallowRef<any | null>(null);
const synced = ref(false);
const connected = ref(false);
const lobbyCode = ref<string | null>(null);

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
    const baseUrl = config.public.lobbyTeleportalUrl || "ws://localhost:1235";
    const wsUrl = new URL(baseUrl);
    if (token) {
      wsUrl.searchParams.set("token", token);
    }

    // Yield to event loop before heavy Provider.create()
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Create connection with keepalive — lobbies can have idle periods
    // (e.g., players reading cards, thinking) so we need a generous timeout.
    const connection = new FallbackConnection({
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
    activeDoc = ydoc;
    activeProvider = provider;
    activeConnection = connection;

    // Expose to composable consumers
    doc.value = ydoc;
    awareness.value = provider.awareness;
    lobbyCode.value = code;
    connected.value = true;

    // Register beforeunload — ensures a clean WebSocket close on
    // page refresh / tab close so the server can immediately GC.
    if (typeof window !== "undefined") {
      // Remove any previous handler first (shouldn't happen, but be safe)
      if (beforeUnloadHandler) {
        window.removeEventListener("beforeunload", beforeUnloadHandler);
      }
      beforeUnloadHandler = () => {
        disconnect();
      };
      window.addEventListener("beforeunload", beforeUnloadHandler);
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
    if (typeof window !== "undefined" && beforeUnloadHandler) {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      beforeUnloadHandler = null;
    }

    if (activeProvider) {
      try {
        activeProvider.destroy?.();
      } catch {
        // Best-effort cleanup
      }
      activeProvider = null;
    }
    if (activeConnection) {
      try {
        activeConnection.destroy?.();
      } catch {
        // Best-effort cleanup
      }
      activeConnection = null;
    }
    if (activeDoc) {
      activeDoc.destroy();
      activeDoc = null;
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
