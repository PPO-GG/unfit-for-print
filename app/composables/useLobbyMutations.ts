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
  settings: {
    maxPoints: number;
    cardsPerPlayer: number;
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
        } satisfies PlayerPayload),
      );

      // Chat — starts empty, add a welcome system message
      const chat = getChat();
      chat.push([
        JSON.stringify({
          id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
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
            id: crypto.randomUUID(),
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
    ydoc.transact(() => {
      // Meta
      getMeta().set("status", "playing");

      // Game state
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

      // Initialize scores for all players
      const scores: Record<string, number> = {};
      for (const playerId of payload.playerOrder) {
        scores[playerId] = 0;
      }
      gs.set("scores", JSON.stringify(scores));

      // Store the player order for judge rotation
      gs.set("playerOrder", JSON.stringify(payload.playerOrder));

      // Store player name map for post-leave name resolution
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

      // Cards
      const cards = getCards();
      cards.set("whiteDeck", JSON.stringify(payload.whiteDeck));
      cards.set("blackDeck", JSON.stringify(payload.blackDeck));
      cards.set("discardWhite", "[]");
      cards.set("discardBlack", "[]");
      cards.set("cardTexts", JSON.stringify(payload.cardTexts));

      // Hands
      const hands = getHands();
      for (const [playerId, hand] of Object.entries(payload.hands)) {
        hands.set(playerId, JSON.stringify(hand));
      }
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
