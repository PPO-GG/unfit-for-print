// composables/useLobbyMutations.ts
// Centralized mutation logic for the lobby Y.Doc.
//
// All writes to the lobby Y.Doc go through this composable to keep
// mutation logic in one place and ensure all multi-field updates
// are wrapped in doc.transact() for atomicity.
//
// Usage:
//   const lobbyDoc = useLobbyDoc()
//   const mutations = useLobbyMutations(lobbyDoc)
//   mutations.initializeLobby({ ... })

import type { LobbyDocResult } from "~/composables/useLobbyDoc";
import type { PlayerId, CardId } from "~/types/game";
import type { CardTexts } from "~/types/gamecards";

// ─── Initialization Payload ─────────────────────────────────────────────────

export interface LobbyInitPayload {
  code: string;
  hostUserId: string;
  hostName: string;
  hostAvatar: string;
  hostActiveDecoration?: string;
  settings: {
    maxPoints: number;
    cardsPerPlayer: number;
    maxPick: number;
    cardPacks: string[];
    isPrivate: boolean;
    lobbyName: string;
    roundEndCountdownDuration?: number;
  };
}

// ─── Player Payload ─────────────────────────────────────────────────────────

export interface PlayerPayload {
  userId: string;
  name: string;
  avatar: string;
  isHost: boolean;
  joinedAt: string;
  provider: string;
  playerType: "player" | "spectator" | "bot";
  activeDecoration?: string;
}

// ─── Game Start Payload (returned by server after card fetch) ────────────────

export interface GameStartPayload {
  whiteDeck: CardId[];
  blackDeck: CardId[];
  blackCard: { id: CardId; text: string; pick: number };
  hands: Record<PlayerId, CardId[]>;
  cardTexts: CardTexts;
  playerOrder: PlayerId[];
  judgeId: PlayerId;
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function useLobbyMutations(lobbyDoc: LobbyDocResult) {
  const {
    doc,
    getMeta,
    getSettings,
    getGameState,
    getCards,
    getHands,
    getPlayers,
    getChat,
  } = lobbyDoc;

  const requireDoc = () => {
    if (!doc.value) throw new Error("[LobbyMutations] No active Y.Doc");
    return doc.value;
  };

  // ── Lobby Initialization ───────────────────────────────────────────────
  // Called by the host after creating the lobby. Sets up the full Y.Doc
  // structure with initial values.

  const initializeLobby = (payload: LobbyInitPayload): void => {
    const ydoc = requireDoc();

    ydoc.transact(() => {
      // Meta
      const meta = getMeta();
      meta.set("code", payload.code);
      meta.set("hostUserId", payload.hostUserId);
      meta.set("status", "waiting");
      meta.set("createdAt", Date.now());

      // Settings
      const settings = getSettings();
      settings.set("maxPoints", payload.settings.maxPoints);
      settings.set("cardsPerPlayer", payload.settings.cardsPerPlayer);
      settings.set("maxPick", payload.settings.maxPick ?? 3);
      settings.set("cardPacks", JSON.stringify(payload.settings.cardPacks));
      settings.set("isPrivate", payload.settings.isPrivate);
      settings.set("lobbyName", payload.settings.lobbyName);
      settings.set(
        "roundEndCountdownDuration",
        payload.settings.roundEndCountdownDuration ?? 5,
      );

      // Game state — blank until game starts
      const gameState = getGameState();
      gameState.set("phase", "waiting");
      gameState.set("round", 0);
      gameState.set("judgeId", null);
      gameState.set("blackCard", null);
      gameState.set("submissions", "{}");
      gameState.set("scores", "{}");
      gameState.set("roundWinner", null);
      gameState.set("winningCards", "[]");
      gameState.set("roundEndStartTime", null);
      gameState.set("skippedPlayers", "[]");
      gameState.set("revealedCards", "{}");
      gameState.set("readAloudText", "");
      gameState.set("gameEndTime", null);

      // Cards — empty until game starts
      const cards = getCards();
      cards.set("whiteDeck", "[]");
      cards.set("blackDeck", "[]");
      cards.set("discardWhite", "[]");
      cards.set("discardBlack", "[]");
      cards.set("cardTexts", "{}");

      // Players — add host as first player
      const players = getPlayers();
      players.set(
        payload.hostUserId,
        JSON.stringify({
          userId: payload.hostUserId,
          name: payload.hostName,
          avatar: payload.hostAvatar,
          isHost: true,
          joinedAt: new Date().toISOString(),
          provider: "appwrite",
          playerType: "player",
          activeDecoration: payload.hostActiveDecoration || "",
        } satisfies PlayerPayload),
      );

      // Chat — starts empty, add a welcome system message
      const chat = getChat();
      chat.push([
        JSON.stringify({
          id: uuid(),
          userId: "system",
          name: "System",
          text: `${payload.hostName} created the lobby`,
          timestamp: Date.now(),
          isSystem: true,
        }),
      ]);
    });
  };

  // ── Player Management ──────────────────────────────────────────────────

  const addPlayer = (player: PlayerPayload): void => {
    const ydoc = requireDoc();
    ydoc.transact(() => {
      getPlayers().set(player.userId, JSON.stringify(player));

      // System chat message
      getChat().push([
        JSON.stringify({
          id: uuid(),
          userId: "system",
          name: "System",
          text: `${player.name} joined the lobby`,
          timestamp: Date.now(),
          isSystem: true,
        }),
      ]);
    });
  };

  const removePlayer = (playerId: string, playerName?: string): void => {
    const ydoc = requireDoc();
    ydoc.transact(() => {
      getPlayers().delete(playerId);
      getHands().delete(playerId);

      if (playerName) {
        getChat().push([
          JSON.stringify({
            id: uuid(),
            userId: "system",
            name: "System",
            text: `${playerName} left the lobby`,
            timestamp: Date.now(),
            isSystem: true,
          }),
        ]);
      }
    });
  };

  // ── Settings ───────────────────────────────────────────────────────────

  const updateSettings = (
    updates: Partial<LobbyInitPayload["settings"]>,
  ): void => {
    const ydoc = requireDoc();
    ydoc.transact(() => {
      const settings = getSettings();
      if (updates.maxPoints !== undefined)
        settings.set("maxPoints", updates.maxPoints);
      if (updates.cardsPerPlayer !== undefined)
        settings.set("cardsPerPlayer", updates.cardsPerPlayer);
      if (updates.maxPick !== undefined)
        settings.set("maxPick", updates.maxPick);
      if (updates.cardPacks !== undefined)
        settings.set("cardPacks", JSON.stringify(updates.cardPacks));
      if (updates.isPrivate !== undefined)
        settings.set("isPrivate", updates.isPrivate);
      if (updates.lobbyName !== undefined)
        settings.set("lobbyName", updates.lobbyName);
      if (updates.roundEndCountdownDuration !== undefined) {
        settings.set(
          "roundEndCountdownDuration",
          updates.roundEndCountdownDuration,
        );
      }
    });
  };

  // ── Game Start ─────────────────────────────────────────────────────────
  // Called after the server returns shuffled cards + resolved texts.
  // Populates the Y.Doc with the initial game state.

  const startGame = (payload: GameStartPayload): void => {
    const ydoc = requireDoc();

    // Split into multiple small transactions. Teleportal silently drops
    // WebSocket messages larger than ~64KB, so each Y.Doc update must
    // stay well under that threshold.

    // 1. Card texts — the largest payload. Split into chunked Y.Map keys
    //    (cardTexts_0, cardTexts_1, ...) of ~100 entries each so no
    //    single JSON blob exceeds ~30KB.
    const cards = getCards();
    const cardTextEntries = Object.entries(payload.cardTexts);
    const CHUNK_SIZE = 100;
    const numChunks = Math.ceil(cardTextEntries.length / CHUNK_SIZE);
    for (let i = 0; i < numChunks; i++) {
      const chunk = cardTextEntries.slice(
        i * CHUNK_SIZE,
        (i + 1) * CHUNK_SIZE,
      );
      const chunkObj: Record<string, any> = {};
      for (const [id, data] of chunk) {
        chunkObj[id] = data;
      }
      ydoc.transact(() => {
        cards.set(`cardTexts_${i}`, JSON.stringify(chunkObj));
      });
    }
    // Store chunk count so readers know how many to merge
    ydoc.transact(() => {
      cards.set("cardTextsChunks", String(numChunks));
    });

    // 2. Decks (split white and black to keep each update small)
    ydoc.transact(() => {
      cards.set("whiteDeck", JSON.stringify(payload.whiteDeck));
      cards.set("discardWhite", "[]");
      cards.set("discardBlack", "[]");
    });
    ydoc.transact(() => {
      cards.set("blackDeck", JSON.stringify(payload.blackDeck));
    });

    // 3. Hands
    ydoc.transact(() => {
      const hands = getHands();
      for (const [playerId, hand] of Object.entries(payload.hands)) {
        hands.set(playerId, JSON.stringify(hand));
      }
    });

    // 4. Game state + meta (triggers phase change — must be last so
    //    card data is already available when clients transition)
    ydoc.transact(() => {
      getMeta().set("status", "playing");

      const gs = getGameState();
      gs.set("phase", "submitting");
      gs.set("round", 1);
      gs.set("judgeId", payload.judgeId);
      gs.set("blackCard", JSON.stringify(payload.blackCard));
      gs.set("submissions", "{}");
      gs.set("roundWinner", null);
      gs.set("winningCards", "[]");
      gs.set("roundEndStartTime", null);
      gs.set("skippedPlayers", "[]");
      gs.set("revealedCards", "{}");
      gs.set("readAloudText", "");
      gs.set("gameEndTime", null);

      const scores: Record<string, number> = {};
      for (const playerId of payload.playerOrder) {
        scores[playerId] = 0;
      }
      gs.set("scores", JSON.stringify(scores));
      gs.set("playerOrder", JSON.stringify(payload.playerOrder));

      const playerNameMap: Record<string, string> = {};
      const playersMap = getPlayers();
      for (const [pid, raw] of playersMap.entries()) {
        try {
          const p = JSON.parse(raw);
          playerNameMap[pid] = p.name;
        } catch {
          /* skip malformed */
        }
      }
      gs.set("players", JSON.stringify(playerNameMap));
    });
  };

  // ── Lobby Status ───────────────────────────────────────────────────────

  const setLobbyStatus = (status: "waiting" | "playing" | "complete"): void => {
    requireDoc().transact(() => {
      getMeta().set("status", status);
    });
  };

  return {
    initializeLobby,
    addPlayer,
    removePlayer,
    updateSettings,
    startGame,
    setLobbyStatus,
  };
}
