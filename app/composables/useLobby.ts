import { ref, computed } from "vue";
import { useUserStore } from "~/stores/userStore";
import { isAnonymousUser } from "~/composables/useUserUtils";
import { getRandomHexString } from "~/composables/useCrypto";
import { useLobbyDoc } from "~/composables/useLobbyDoc";
import { useLobbyMutations } from "~/composables/useLobbyMutations";
import { useLobbyReactive } from "~/composables/useLobbyReactive";
import { useYjsGameEngine } from "~/composables/useYjsGameEngine";
import { useCards } from "~/composables/useCards";
import type { Lobby } from "~/types/lobby";
import type { Player } from "~/types/player";

export const useLobby = () => {
  const { $activityFetch } = useNuxtApp();
  const userStore = useUserStore();

  // ── Y.Doc Infrastructure ──────────────────────────────────────────────
  // Singleton lobby doc + derived composables.
  const lobbyDoc = useLobbyDoc();
  const mutations = useLobbyMutations(lobbyDoc);
  const reactive = useLobbyReactive(lobbyDoc);
  const engine = useYjsGameEngine(lobbyDoc);

  // Compatibility shim: `players` ref that mirrors the Y.Doc reactive player list.
  // Consumers that read `useLobby().players` continue to work without changes.
  const players = computed<Player[]>(() => reactive.playerList.value);

  // ── Appwrite Registry (discovery only) ────────────────────────────────

  const getLobbyByCode = async (code: string): Promise<Lobby | null> => {
    try {
      return await $activityFetch<Lobby | null>(
        "/api/lobby/by-code/" + code,
      );
    } catch (error) {
      console.warn("[useLobby] Failed to fetch lobby by code:", error);
      return null;
    }
  };

  const getLobbyByInstanceId = async (
    instanceId: string,
  ): Promise<Lobby | null> => {
    try {
      return await $activityFetch<Lobby | null>(
        "/api/lobby/by-instance/" + instanceId,
      );
    } catch {
      return null;
    }
  };

  const getLobbiesByChannelId = async (
    discordChannelId: string,
  ): Promise<Lobby[]> => {
    try {
      return await $activityFetch<Lobby[]>(
        "/api/lobby/by-channel/" + discordChannelId,
      );
    } catch {
      return [];
    }
  };

  const updateLobbyPrivacy = async (
    lobbyId: string,
    vcOnly: boolean,
  ): Promise<void> => {
    await $activityFetch("/api/lobby/privacy", {
      method: "POST",
      body: { lobbyId, vcOnly },
    });
  };

  const getActiveLobbyForUser = async (
    userId: string,
  ): Promise<Lobby | null> => {
    try {
      return await $activityFetch<Lobby | null>("/api/lobby/active");
    } catch (error) {
      console.warn("[useLobby] Failed to fetch active lobby:", error);
      return null;
    }
  };

  // ── Create Lobby ──────────────────────────────────────────────────────
  // Creates the lobby registry row via the server API, then initializes
  // the Y.Doc. Identity/session bootstrap happens before this is called
  // (see useJoinLobby.ts).

  const createLobby = async (
    hostUserId: string,
    lobbyName?: string,
    isPrivate?: boolean,
    _password?: string,
    discordInstanceId?: string,
    discordChannelId?: string,
    vcOnly?: boolean,
  ) => {
    // Check if the user already has an active lobby
    const existingLobby = await getActiveLobbyForUser(hostUserId);
    if (existingLobby) {
      throw new Error(
        "You already have an active lobby. Please finish or leave that lobby before creating a new one.",
      );
    }

    const displayName =
      lobbyName || `${userStore.user?.name || "Anonymous"}'s Game`;

    const lobby = await $activityFetch<Lobby>("/api/lobby/create", {
      method: "POST",
      body: {
        hostUserId,
        lobbyName: displayName,
        discordInstanceId,
        discordChannelId,
        vcOnly,
      },
    });

    // Connect to Teleportal Y.Doc and initialize the full structure
    await lobbyDoc.connect(lobby.code);

    const user = userStore.user;
    const avatarUrl = user?.avatarUrl ?? null;
    const activeDecoration = user?.activeDecoration || "";
    const cardPacks = await useCards().fetchDefaultPacks();

    mutations.initializeLobby({
      code: lobby.code,
      hostUserId,
      hostName: user?.name ?? "Anonymous",
      hostAvatar: avatarUrl || "",
      hostActiveDecoration: activeDecoration,
      settings: {
        maxPoints: 10,
        cardsPerPlayer: 10,
        maxPick: 3,
        cardPacks,
        isPrivate: isPrivate || false,
        lobbyName: displayName,
        roundEndCountdownDuration: 5,
      },
    });

    return { ...lobby };
  };

  // ── Join Lobby ────────────────────────────────────────────────────────
  // Looks up the lobby registry, connects to the existing Y.Doc, and adds
  // the player via Y.Doc mutations. Identity/session bootstrap happens
  // before this is called (see useJoinLobby.ts) — by the time this runs,
  // requireAuth on the server already has a valid session to resolve the
  // user from.

  const joinLobby = async (
    code: string,
    options?: { username?: string; isHost?: boolean; skipSession?: boolean },
  ) => {
    const { isDiscordActivity } = useDiscordSDK();
    const isActivitySession = isDiscordActivity.value && !!userStore.user;

    const enrichedUser = userStore.user;
    if (!enrichedUser) throw new Error("User session could not be loaded");

    const provider = isActivitySession
      ? "discord"
      : enrichedUser.discordUserId
        ? "discord"
        : "anonymous";

    const username = options?.username ?? enrichedUser.name ?? "Unknown";

    const lobby = await getLobbyByCode(code);
    if (!lobby) throw new Error("Lobby not found");

    // Connect to the existing Y.Doc (if not already connected for this code)
    if (lobbyDoc.lobbyCode.value !== code) {
      await lobbyDoc.connect(code);
    }

    // Determine player type: spectators if game is in progress
    const meta = lobbyDoc.getMeta();
    const status = meta.get("status") || "waiting";
    const playerType = status === "playing" ? "spectator" : "player";

    // Check if player is already in the Y.Doc
    const existingPlayer = lobbyDoc.getPlayers().get(enrichedUser.id);
    const avatarUrl = enrichedUser.avatarUrl ?? null;

    if (!existingPlayer) {
      const activeDecoration = enrichedUser.activeDecoration || "";

      mutations.addPlayer({
        userId: enrichedUser.id,
        name: username,
        avatar: avatarUrl || "",
        isHost: !!options?.isHost,
        joinedAt: new Date().toISOString(),
        provider,
        playerType,
        activeDecoration,
      });
    }

    // Server-side player row so requirePlayerInLobby/requireHost can find
    // this player. Always called (not just when the Y.Doc lacked the
    // player) — the route is idempotent (returns the existing row rather
    // than erroring/duplicating), and this guarantees `serverPlayer` is
    // populated even on a rejoin/refresh where the Y.Doc already had this
    // player locally but the caller still needs the player row's id.
    let serverPlayer: { id: string; [key: string]: any } | null = null;
    try {
      const joinResult = await $activityFetch<{
        lobby: Lobby;
        player: { id: string; [key: string]: any };
      }>("/api/lobby/join", {
        method: "POST",
        body: {
          code,
          playerName: username,
          avatar: avatarUrl || "",
          playerType,
        },
      });
      serverPlayer = joinResult?.player ?? null;
    } catch (err) {
      console.warn("[useLobby] Failed to create player row:", err);
    }

    return { ...lobby, player: serverPlayer };
  };

  // ── Is In Lobby ───────────────────────────────────────────────────────
  // Checks Y.Doc players map first, falls back to the server for
  // pre-connect state (e.g. page refresh before the Y.Doc reconnects).

  const isInLobby = async (userId: string, lobbyId: string) => {
    // If Y.Doc is connected, check the players map directly
    if (lobbyDoc.doc.value) {
      try {
        return !!lobbyDoc.getPlayers().get(userId);
      } catch {
        // Y.Doc not ready — fall through to the server
      }
    }

    // Fallback: derive from the user's active lobby (for pre-connect state)
    const activeLobby = await getActiveLobbyForUser(userId);
    return !!activeLobby && activeLobby.id === lobbyId;
  };

  // ── Leave Lobby ───────────────────────────────────────────────────────
  // Removes player from Y.Doc, handles host promotion, disconnects if last human.

  const leaveLobby = async (lobbyId: string, userId: string) => {
    // Get player name before removing (for system message)
    const playerJson = lobbyDoc.doc.value
      ? lobbyDoc.getPlayers().get(userId)
      : null;
    let playerName: string | undefined;
    if (playerJson) {
      try {
        playerName = JSON.parse(playerJson).name;
      } catch {
        /* ignore */
      }
    }

    // If game is playing, handle player-leave game state via engine
    const meta = lobbyDoc.doc.value ? lobbyDoc.getMeta() : null;
    const status = meta?.get("status");
    if (status === "playing") {
      try {
        engine.handlePlayerLeave(userId);
      } catch (err) {
        console.error("Failed to process player leave game state:", err);
      }
    }

    // Remove from Y.Doc
    mutations.removePlayer(userId, playerName);

    // Remove the player row on the server, and tear down the lobby
    // registry row too if this was the last human (self-heal logic moved
    // server-side — see /api/lobby/leave).
    try {
      await $activityFetch("/api/lobby/leave", {
        method: "POST",
        body: { lobbyId },
      });
    } catch (err) {
      console.warn("[useLobby] Failed to leave lobby on server:", err);
    }

    // Check remaining human players
    const playersMap = lobbyDoc.doc.value ? lobbyDoc.getPlayers() : null;
    const remainingHumans: Array<{ id: string; data: any }> = [];
    if (playersMap) {
      for (const [pid, raw] of playersMap.entries()) {
        try {
          const p = JSON.parse(raw);
          if (p.playerType !== "bot" && p.playerType !== "spectator") {
            remainingHumans.push({ id: pid, data: p });
          }
        } catch {
          /* skip malformed */
        }
      }
    }

    // If no human players remain, tear down
    if (remainingHumans.length === 0) {
      // Disconnect Y.Doc — Teleportal will GC the doc
      lobbyDoc.disconnect();
      return;
    }

    // Host left — promote a new one via Y.Doc
    const hostUserId = meta?.get("hostUserId");
    if (hostUserId === userId && remainingHumans.length > 0) {
      const newHost = remainingHumans[0]!;
      lobbyDoc.doc.value?.transact(() => {
        // Update meta
        lobbyDoc.getMeta().set("hostUserId", newHost.id);

        // Update player record
        const updatedPlayer = { ...newHost.data, isHost: true };
        lobbyDoc.getPlayers().set(newHost.id, JSON.stringify(updatedPlayer));

        // Demote all other players
        for (const other of remainingHumans.slice(1)) {
          const otherData = { ...other.data, isHost: false };
          lobbyDoc.getPlayers().set(other.id, JSON.stringify(otherData));
        }
      });
    }

    // Always disconnect this client's WebSocket after mutations are sent.
    // Small delay ensures the Y.Doc mutations are flushed to the server
    // before we tear down the connection.
    await new Promise((resolve) => setTimeout(resolve, 100));
    lobbyDoc.disconnect();
  };

  // ── Start Game ────────────────────────────────────────────────────────
  // Fetches cards from server, then writes full game state into Y.Doc.

  const startGame = async (
    lobbyId: string,
    gameSettings?: {
      maxPoints?: number;
      numPlayerCards?: number;
      cardPacks?: string[];
      isPrivate?: boolean;
      lobbyName?: string;
      maxPick?: number;
      $id?: string;
    } | null,
  ) => {
    // Validate player count from Y.Doc
    const playersMap = lobbyDoc.getPlayers();
    const playerIds: string[] = [];
    for (const [pid, raw] of playersMap.entries()) {
      try {
        const p = JSON.parse(raw);
        if (p.playerType !== "spectator") {
          playerIds.push(pid);
        }
      } catch {
        /* skip */
      }
    }

    if (playerIds.length < 3) throw new Error("Not enough players to start");

    // Convert spectators to players
    lobbyDoc.doc.value?.transact(() => {
      for (const [pid, raw] of playersMap.entries()) {
        try {
          const p = JSON.parse(raw);
          if (p.playerType === "bot") continue;
          if (p.playerType !== "player") {
            p.playerType = "player";
            playersMap.set(pid, JSON.stringify(p));
          }
        } catch {
          /* skip */
        }
      }
    });

    // Call server to fetch and shuffle cards from Appwrite
    // (card packs are permanent Appwrite data)
    const result = await $fetch<{
      success: boolean;
      error?: string;
      whiteDeck: string[];
      blackDeck: string[];
      blackCard: { id: string; text: string; pick: number };
      hands: Record<string, string[]>;
      cardTexts: Record<string, { text: string; pack: string }>;
      playerOrder: string[];
      judgeId: string;
      config: {
        maxPoints: number;
        cardsPerPlayer: number;
        maxPick: number;
        cardPacks: string[];
        isPrivate: boolean;
        lobbyName: string;
      };
    }>("/api/game/start", {
      method: "POST",
      body: {
        lobbyId,
        settings: gameSettings
          ? {
              ...gameSettings,
              lobbyId:
                typeof (gameSettings as any).lobbyId === "object"
                  ? lobbyId
                  : (gameSettings as any).lobbyId,
            }
          : undefined,
        userId: userStore.user?.id,
      },
    });

    if (!result || !result.success) {
      throw new Error(result?.error || "Failed to start game");
    }

    // Sync the server-returned config into the Y.Doc settings so all
    // downstream consumers (nextRound, reshufflePlayerCards) use the
    // actual game configuration rather than the initial defaults.
    mutations.updateSettings({
      maxPoints: result.config.maxPoints,
      cardsPerPlayer: result.config.cardsPerPlayer,
      maxPick: result.config.maxPick,
      cardPacks: result.config.cardPacks,
      isPrivate: result.config.isPrivate,
      lobbyName: result.config.lobbyName,
    });

    // Write the game state into Y.Doc — all clients see this instantly
    mutations.startGame({
      whiteDeck: result.whiteDeck,
      blackDeck: result.blackDeck,
      blackCard: result.blackCard,
      hands: result.hands,
      cardTexts: result.cardTexts,
      playerOrder: result.playerOrder,
      judgeId: result.judgeId,
    });

    return result;
  };

  // ── Kick Player ───────────────────────────────────────────────────────

  const kickPlayer = async (playerId: string) => {
    // Get name for system message
    const raw = lobbyDoc.doc.value ? lobbyDoc.getPlayers().get(playerId) : null;
    let name: string | undefined;
    if (raw) {
      try {
        name = JSON.parse(raw).name;
      } catch {
        /* ignore */
      }
    }

    // Auto-skip before removing so the round can advance if needed
    engine.skipPlayer(playerId);

    mutations.removePlayer(playerId, name);
  };

  // ── Promote to Host ───────────────────────────────────────────────────

  const promoteToHost = async (lobbyId: string, newHostPlayer: Player) => {
    const playersMap = lobbyDoc.getPlayers();

    // Capture the current host BEFORE the transaction so we can demote them.
    const currentHostId = lobbyDoc.getMeta().get("hostUserId");

    lobbyDoc.doc.value?.transact(() => {
      // 1. Update meta so all clients derive the correct isHost value
      lobbyDoc.getMeta().set("hostUserId", newHostPlayer.userId);

      // 2. Promote the new host's player record
      const rawNew = playersMap.get(newHostPlayer.userId);
      if (rawNew) {
        try {
          const p = JSON.parse(rawNew);
          p.isHost = true;
          playersMap.set(newHostPlayer.userId, JSON.stringify(p));
        } catch {
          /* ignore */
        }
      }

      // 3. Demote the OLD host's player record so they no longer appear as host
      if (currentHostId && currentHostId !== newHostPlayer.userId) {
        const rawOld = playersMap.get(currentHostId);
        if (rawOld) {
          try {
            const p = JSON.parse(rawOld);
            p.isHost = false;
            playersMap.set(currentHostId, JSON.stringify(p));
          } catch {
            /* ignore */
          }
        }
      }
    });

    // 4. Sync the new host to the server (lobby registry row + player rows).
    //    This keeps server-side checks (requireHost) and discovery queries
    //    accurate. Fire-and-forget — Y.Doc is the authority; the server
    //    record is a best-effort mirror.
    if (lobbyId) {
      try {
        await $activityFetch("/api/lobby/promote-host", {
          method: "POST",
          body: { lobbyId, newHostUserId: newHostPlayer.userId },
        });
      } catch (err) {
        console.warn(
          "[useLobby] Failed to sync new host to server:",
          err,
        );
      }
    }
  };

  // ── Reset Game State ──────────────────────────────────────────────────
  // Delegates to useYjsGameEngine.resetGame()

  const resetGameState = async (_lobbyId: string) => {
    engine.resetGame();
    return true;
  };

  // ── Reshuffle Player Cards ────────────────────────────────────────────
  // Same logic as before, but operating on Y.Doc maps instead of Appwrite.

  const reshufflePlayerCards = async (_lobbyId: string) => {
    const ydoc = lobbyDoc.doc.value;
    if (!ydoc) throw new Error("No active Y.Doc");

    const gs = lobbyDoc.getGameState();
    const cards = lobbyDoc.getCards();
    const handsMap = lobbyDoc.getHands();

    const phase = gs.get("phase");
    if (phase !== "submitting" && phase !== "judging") {
      throw new Error("Cannot reshuffle cards outside of an active game");
    }

    const judgeId = gs.get("judgeId");

    ydoc.transact(() => {
      // Collect all cards from all players' hands
      const allCards: string[] = [];
      const playerIds: string[] = [];
      const uniqueCards = new Set<string>();

      for (const [pid, rawHand] of handsMap.entries()) {
        playerIds.push(pid);
        try {
          const hand: string[] = JSON.parse(rawHand);
          for (const cardId of hand) {
            if (!uniqueCards.has(cardId)) {
              uniqueCards.add(cardId);
              allCards.push(cardId);
            }
          }
        } catch {
          /* skip malformed */
        }
      }

      // Shuffle all collected cards (Fisher-Yates)
      const shuffledCards = [...allCards];
      for (let i = shuffledCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledCards[i], shuffledCards[j]] = [
          shuffledCards[j]!,
          shuffledCards[i]!,
        ];
      }

      // Read the configured hand size from Y.Doc settings
      const settingsMap = lobbyDoc.getSettings();
      let numCards = 10;
      try {
        const raw = settingsMap.get("cardsPerPlayer");
        if (raw !== undefined && raw !== null) numCards = Number(raw) || 10;
      } catch {
        /* use default */
      }

      // Redistribute cards to each non-judge player
      let cardIndex = 0;
      for (const pid of playerIds) {
        if (pid === judgeId) {
          handsMap.set(pid, "[]");
          continue;
        }
        const newHand: string[] = [];
        for (let i = 0; i < numCards && cardIndex < shuffledCards.length; i++) {
          newHand.push(shuffledCards[cardIndex]!);
          cardIndex++;
        }
        handsMap.set(pid, JSON.stringify(newHand));
      }

      // If we need more cards, draw from the deck
      if (cardIndex >= shuffledCards.length) {
        let whiteDeck: string[];
        try {
          whiteDeck = JSON.parse(cards.get("whiteDeck") || "[]");
        } catch {
          whiteDeck = [];
        }

        if (whiteDeck.length > 0) {
          // Filter deck to remove cards already in hands
          const dealtCards = new Set<string>();
          for (const pid of playerIds) {
            try {
              const hand: string[] = JSON.parse(handsMap.get(pid) || "[]");
              for (const id of hand) dealtCards.add(id);
            } catch {
              /* skip */
            }
          }
          whiteDeck = whiteDeck.filter((id) => !dealtCards.has(id));

          // Distribute from deck
          for (const pid of playerIds) {
            if (pid === judgeId) continue;
            try {
              const hand: string[] = JSON.parse(handsMap.get(pid) || "[]");
              if (hand.length < numCards) {
                const needed = numCards - hand.length;
                const extras = whiteDeck.splice(0, needed);
                hand.push(...extras);
                handsMap.set(pid, JSON.stringify(hand));
              }
            } catch {
              /* skip */
            }
          }

          cards.set("whiteDeck", JSON.stringify(whiteDeck));
        }
      }

      // Reset submissions since hands have changed
      gs.set("submissions", "{}");
    });

    return true;
  };

  // ── Mark Player Returned to Lobby ─────────────────────────────────────
  // Delegates to useYjsGameEngine.markReturnedToLobby()

  const markPlayerReturnedToLobby = async (
    _lobbyId: string,
    playerId: string,
  ) => {
    engine.markReturnedToLobby(playerId);
    return true;
  };

  // ── Check All Players Returned ────────────────────────────────────────
  // Reads from Y.Doc reactive state.

  const checkAllPlayersReturned = async (_lobbyId: string) => {
    const gs = reactive.gameState.value;
    if (!gs || gs.phase !== "complete") return false;

    const autoReturnTime = 60 * 1000;
    const timeElapsed = gs.gameEndTime ? Date.now() - gs.gameEndTime : 0;

    const allPlayerIds = reactive.playerList.value.map((p) => p.userId);
    const allReturned = allPlayerIds.every(
      (pid) => gs.returnedToLobby && gs.returnedToLobby[pid],
    );

    return allReturned || timeElapsed >= autoReturnTime;
  };

  // ── Fetch Players (compatibility — reads from Y.Doc) ──────────────────

  const fetchPlayers = async (_lobbyId: string) => {
    // No-op: players are reactive via useLobbyReactive.playerList
    // This function exists only for signature compatibility.
  };

  return {
    players,
    fetchPlayers,
    createLobby,
    joinLobby,
    getLobbyByCode,
    getLobbyByInstanceId,
    getLobbiesByChannelId,
    updateLobbyPrivacy,
    leaveLobby,
    isInLobby,

    startGame,
    kickPlayer,
    promoteToHost,
    getActiveLobbyForUser,
    resetGameState,
    reshufflePlayerCards,
    markPlayerReturnedToLobby,
    checkAllPlayersReturned,

    // Y.Doc infrastructure — exposed for consumers that need direct access
    lobbyDoc,
    reactive,
    mutations,
    engine,
  };
};
