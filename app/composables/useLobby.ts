import { ref, computed } from "vue";
import { ID, type Models, Permission, Query, Role } from "appwrite";
import { useUserStore } from "~/stores/userStore";
import { isAnonymousUser } from "~/composables/useUserUtils";
import { usePlayers } from "~/composables/usePlayers";
import { getAppwrite } from "~/utils/appwrite";
import { getRandomHexString } from "~/composables/useCrypto";
import { useLobbyDoc } from "~/composables/useLobbyDoc";
import { useLobbyMutations } from "~/composables/useLobbyMutations";
import { useLobbyReactive } from "~/composables/useLobbyReactive";
import { useYjsGameEngine } from "~/composables/useYjsGameEngine";
import type { Lobby } from "~/types/lobby";
import type { Player } from "~/types/player";

export const useLobby = () => {
  const { getUserAvatarUrl } = usePlayers();
  const getConfig = () => useRuntimeConfig();
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
    const { tables } = getAppwrite();
    const config = getConfig();
    try {
      const result = await tables.listRows({
        databaseId: config.public.appwriteDatabaseId,
        tableId: config.public.appwriteLobbyCollectionId,
        queries: [Query.equal("code", code), Query.limit(1)],
      });
      return result.rows[0] ? (result.rows[0] as unknown as Lobby) : null;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === 404 &&
        error.message?.includes(
          "Collection with the requested ID could not be found",
        )
      ) {
        console.warn("Lobby collection not initialized");
        return null;
      }
      throw error;
    }
  };

  const getActiveLobbyForUser = async (
    userId: string,
  ): Promise<Lobby | null> => {
    const { tables } = getAppwrite();
    const config = getConfig();

    try {
      const playerRes = await tables.listRows({
        databaseId: config.public.appwriteDatabaseId,
        tableId: config.public.appwritePlayerCollectionId,
        queries: [Query.equal("userId", userId), Query.limit(1)],
      });

      if (playerRes.total === 0) return null;

      const playerDoc = playerRes.rows[0]!;

      let lobby;
      try {
        lobby = await tables.getRow({
          databaseId: config.public.appwriteDatabaseId,
          tableId: config.public.appwriteLobbyCollectionId,
          rowId: playerDoc.lobbyId,
        });
      } catch (lookupErr: any) {
        // Stale player doc pointing to a deleted lobby — clean slate
        if (
          lookupErr?.code === 404 ||
          lookupErr?.message?.includes("could not be found")
        ) {
          console.warn(
            "[useLobby] Stale player doc references missing lobby:",
            playerDoc.lobbyId,
          );
          return null;
        }
        throw lookupErr;
      }

      if (lobby.status === "complete") return null;
      return lobby as unknown as Lobby;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === 404 &&
        error.message?.includes(
          "Collection with the requested ID could not be found",
        )
      ) {
        console.warn("Players or lobby collection not initialized");
        return null;
      }
      throw error;
    }
  };

  // ── Create Lobby ──────────────────────────────────────────────────────
  // Creates a minimal Appwrite registry doc, then initializes the Y.Doc.

  const createLobby = async (
    hostUserId: string,
    lobbyName?: string,
    isPrivate?: boolean,
    _password?: string,
  ) => {
    const { tables } = getAppwrite();
    const config = getConfig();

    // Check if the user already has an active lobby
    const existingLobby = await getActiveLobbyForUser(hostUserId);
    if (existingLobby) {
      throw new Error(
        "You already have an active lobby. Please finish or leave that lobby before creating a new one.",
      );
    }

    // Generate a cryptographically secure random lobby code
    const randomValue = getRandomHexString(4);
    const lobbyCode = randomValue.substring(0, 6).toUpperCase();

    try {
      // Create minimal Appwrite registry doc (discovery only)
      const lobbyData = {
        hostUserId,
        code: lobbyCode,
        status: "waiting",
        round: 0,
        gameState: "{}",
      };

      const permissions = [
        Permission.read(Role.any()),
        Permission.update(Role.user(hostUserId)),
        Permission.delete(Role.user(hostUserId)),
      ];

      const lobby = await tables.createRow({
        databaseId: config.public.appwriteDatabaseId,
        tableId: config.public.appwriteLobbyCollectionId,
        rowId: ID.unique(),
        data: lobbyData,
        permissions,
      });

      // Connect to Teleportal Y.Doc and initialize the full structure
      await lobbyDoc.connect(lobbyCode);

      const displayName =
        lobbyName || `${userStore.user?.name || "Anonymous"}'s Game`;

      const user = userStore.user;
      const session = userStore.session;
      const avatarUrl = user
        ? getUserAvatarUrl(user as any, session?.provider)
        : null;

      mutations.initializeLobby({
        code: lobbyCode,
        hostUserId,
        hostName: user?.name ?? "Anonymous",
        hostAvatar: avatarUrl || "",
        settings: {
          maxPoints: 10,
          cardsPerPlayer: 7,
          cardPacks: ["CAH Base Set"],
          isPrivate: isPrivate || false,
          lobbyName: displayName,
          roundEndCountdownDuration: 5,
        },
      });

      // Compatibility shim: create Appwrite player doc so server-side
      // APIs (requirePlayerInLobby, requireHost) can find the host.
      try {
        await tables.createRow({
          databaseId: config.public.appwriteDatabaseId,
          tableId: config.public.appwritePlayerCollectionId,
          rowId: ID.unique(),
          data: {
            userId: hostUserId,
            lobbyId: lobby.$id,
            name: user?.name ?? "Anonymous",
            avatar: avatarUrl || "",
            isHost: true,
            joinedAt: new Date().toISOString(),
            provider: userStore.session?.provider || "anonymous",
            playerType: "player",
          },
          permissions: [
            Permission.read(Role.any()),
            Permission.update(Role.user(hostUserId)),
            Permission.delete(Role.user(hostUserId)),
          ],
        });
      } catch (err) {
        console.warn("[useLobby] Failed to create Appwrite player shim:", err);
      }

      return { ...lobby };
    } catch (error: unknown) {
      if (error instanceof Error) {
        const message =
          error.message ===
          "Unable to create lobby: Database not properly configured"
            ? `Database configuration error. Please verify collections exist: Lobby (${config.public.appwriteLobbyCollectionId})`
            : error.message;
        throw new Error(message);
      }
      throw error;
    }
  };

  // ── Join Lobby ────────────────────────────────────────────────────────
  // Looks up the Appwrite registry, connects to the existing Y.Doc,
  // and adds the player via Y.Doc mutations.

  const joinLobby = async (
    code: string,
    options?: { username?: string; isHost?: boolean; skipSession?: boolean },
  ) => {
    const { account } = getAppwrite();
    if (!userStore.session && !options?.skipSession) {
      await account.createAnonymousSession();
    }

    // Fetch the session to know the provider
    const session = await account.getSession("current");

    // Enrich the store with OAuth prefs (avatar hash, discordUserId, etc.)
    await userStore.fetchUserSession();

    const enrichedUser = userStore.user;
    if (!enrichedUser) throw new Error("User session could not be loaded");

    // Also fetch raw Appwrite user for avatar resolution
    const rawUser = await account.get();
    rawUser.prefs = { ...rawUser.prefs, ...enrichedUser.prefs };

    const username =
      options?.username ??
      enrichedUser.name ??
      rawUser.prefs?.name ??
      "Unknown";

    const lobby = await getLobbyByCode(code);
    if (!lobby) throw new Error("Lobby not found");

    await account.updatePrefs({ name: username });

    // Connect to the existing Y.Doc (if not already connected for this code)
    if (lobbyDoc.lobbyCode.value !== code) {
      await lobbyDoc.connect(code);
    }

    // Determine player type: spectators if game is in progress
    const meta = lobbyDoc.getMeta();
    const status = meta.get("status") || "waiting";
    const playerType = status === "playing" ? "spectator" : "player";

    // Check if player is already in the Y.Doc
    const existingPlayer = lobbyDoc.getPlayers().get(rawUser.$id);
    if (!existingPlayer) {
      const avatarUrl = getUserAvatarUrl(rawUser as any, session.provider);

      mutations.addPlayer({
        userId: rawUser.$id,
        name: username,
        avatar:
          avatarUrl || (rawUser.prefs as Record<string, any>)?.avatar || "",
        isHost: !!options?.isHost,
        joinedAt: new Date().toISOString(),
        provider: session.provider,
        playerType,
      });

      // Compatibility shim: create Appwrite player doc so server-side
      // APIs (requirePlayerInLobby) can find this player.
      const { tables } = getAppwrite();
      const config = getConfig();
      try {
        await tables.createRow({
          databaseId: config.public.appwriteDatabaseId,
          tableId: config.public.appwritePlayerCollectionId,
          rowId: ID.unique(),
          data: {
            userId: rawUser.$id,
            lobbyId: lobby.$id,
            name: username,
            avatar:
              avatarUrl || (rawUser.prefs as Record<string, any>)?.avatar || "",
            isHost: !!options?.isHost,
            joinedAt: new Date().toISOString(),
            provider: session.provider,
            playerType,
          },
          permissions: [
            Permission.read(Role.any()),
            Permission.update(Role.user(rawUser.$id)),
            Permission.delete(Role.user(rawUser.$id)),
          ],
        });
      } catch (err) {
        console.warn("[useLobby] Failed to create Appwrite player shim:", err);
      }
    }

    return { ...lobby };
  };

  // ── Is In Lobby ───────────────────────────────────────────────────────
  // Checks Y.Doc players map first, falls back to Appwrite for pre-connect state.

  const isInLobby = async (userId: string, lobbyId: string) => {
    // If Y.Doc is connected, check the players map directly
    if (lobbyDoc.doc.value) {
      try {
        return !!lobbyDoc.getPlayers().get(userId);
      } catch {
        // Y.Doc not ready — fall through to Appwrite
      }
    }

    // Fallback: Appwrite query (for pre-connect state, e.g., page refresh)
    const { tables } = getAppwrite();
    const config = getConfig();
    const res = await tables.listRows({
      databaseId: config.public.appwriteDatabaseId,
      tableId: config.public.appwritePlayerCollectionId,
      queries: [
        Query.equal("userId", userId),
        Query.equal("lobbyId", lobbyId),
        Query.limit(1),
      ],
    });
    return res.total > 0;
  };

  // ── Leave Lobby ───────────────────────────────────────────────────────
  // Removes player from Y.Doc, handles host promotion, disconnects if last human.

  const leaveLobby = async (lobbyId: string, userId: string) => {
    const { tables } = getAppwrite();
    const config = getConfig();

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

      // Clean up Appwrite registry
      try {
        await tables.deleteRow({
          databaseId: config.public.appwriteDatabaseId,
          tableId: config.public.appwriteLobbyCollectionId,
          rowId: lobbyId,
        });
      } catch (err) {
        console.warn("Failed to delete Appwrite lobby registry:", err);
      }

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
        cardPacks: string[];
        isPrivate: boolean;
        lobbyName: string;
      };
    }>("/api/game/start", {
      method: "POST",
      body: {
        lobbyId,
        documentId: gameSettings?.$id,
        settings: gameSettings
          ? {
              ...gameSettings,
              lobbyId:
                typeof (gameSettings as any).lobbyId === "object"
                  ? lobbyId
                  : (gameSettings as any).lobbyId,
            }
          : undefined,
        userId: userStore.user?.$id,
      },
    });

    if (!result || !result.success) {
      throw new Error(result?.error || "Failed to start game");
    }

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
    mutations.removePlayer(playerId, name);
  };

  // ── Promote to Host ───────────────────────────────────────────────────

  const promoteToHost = async (_lobbyId: string, newHostPlayer: Player) => {
    lobbyDoc.doc.value?.transact(() => {
      lobbyDoc.getMeta().set("hostUserId", newHostPlayer.userId);

      // Update the new host's player record
      const raw = lobbyDoc.getPlayers().get(newHostPlayer.userId);
      if (raw) {
        try {
          const p = JSON.parse(raw);
          p.isHost = true;
          lobbyDoc.getPlayers().set(newHostPlayer.userId, JSON.stringify(p));
        } catch {
          /* ignore */
        }
      }
    });
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

      // Redistribute 7 cards to each non-judge player
      let cardIndex = 0;
      for (const pid of playerIds) {
        if (pid === judgeId) {
          handsMap.set(pid, "[]");
          continue;
        }
        const newHand: string[] = [];
        for (let i = 0; i < 7 && cardIndex < shuffledCards.length; i++) {
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
              if (hand.length < 7) {
                const needed = 7 - hand.length;
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
