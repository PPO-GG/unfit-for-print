import { onUnmounted } from "vue";
import type { Ref, ComputedRef } from "vue";
import type { Client, Databases } from "appwrite";
import type { Lobby } from "~/types/lobby";
import type { Player } from "~/types/player";
import type { GameSettings } from "~/types/gamesettings";
import type { GameCards } from "~/types/gamecards";
import { getAppwrite } from "~/utils/appwrite";
import { usePlayers } from "~/composables/usePlayers";
import { useGameSettings } from "~/composables/useGameSettings";
import { useNotifications } from "~/composables/useNotifications";
import { useSfx } from "~/composables/useSfx";
import { useUserStore } from "~/stores/userStore";
import { useI18n } from "vue-i18n";
import { resolveId } from "~/utils/resolveId";
import { SFX } from "~/config/sfx.config";

const LEAVE_DEBOUNCE_TIME = 5000;

function debounce(func: (...args: any[]) => void, wait: number) {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Manages all Appwrite real-time subscriptions for the game page:
 * - Lobby document changes (updates, deletes)
 * - Player collection events (join, leave, kick)
 * - Game settings updates
 * - Game cards updates (via subscribeToGameCards)
 *
 * Also handles player event debouncing and system chat messages.
 */
export function useGameRealtime(options: {
  lobby: Ref<Lobby | null>;
  players: Ref<Player[]>;
  gameSettings: Ref<GameSettings | null>;
  isHost: ComputedRef<boolean>;
  selfLeaving: Ref<boolean>;
  subscribeToGameCards: (
    lobbyId: string,
    onUpdate?: (cards: GameCards) => void,
  ) => () => void;
}) {
  const {
    lobby,
    players,
    gameSettings,
    isHost,
    selfLeaving,
    subscribeToGameCards,
  } = options;

  const userStore = useUserStore();
  const { getPlayersForLobby } = usePlayers();
  const { getGameSettings, createDefaultGameSettings } = useGameSettings();
  const { notify } = useNotifications();
  const { playSfx } = useSfx();
  const { t } = useI18n();
  const router = useRouter();

  const { client, databases } = getAppwrite();

  const recentPlayerEvents = new Map<string, number>();
  const cleanupFunctions: (() => void)[] = [];

  // Register cleanup at composable creation (during setup context)
  onUnmounted(() => {
    cleanupFunctions.forEach((fn) => fn());
    cleanupFunctions.length = 0;
  });

  /** Sends a system message to the lobby chat via server endpoint */
  const sendSystemMessage = async (lobbyId: string, message: string) => {
    if (!message || !message.trim()) return;

    try {
      await $fetch("/api/chat/system", {
        method: "POST",
        body: {
          lobbyId,
          text: message.trim(),
          userId: userStore.user?.$id,
        },
      });
    } catch (error) {
      console.error("Error sending system message:", error);
    }
  };

  /** Subscribes to game settings changes for the given lobby */
  const setupGameSettingsRealtime = (lobbyId: string) => {
    if (!client) return;
    const config = useRuntimeConfig();

    return client.subscribe(
      [
        `databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwriteGameSettingsCollectionId}.documents`,
      ],
      async ({ payload }: { events: string[]; payload: unknown }) => {
        const settings = payload as GameSettings;
        const settingsLobbyId = resolveId(settings.lobbyId);

        if (settingsLobbyId === lobbyId) {
          gameSettings.value = settings;
          if (!isHost.value) {
            notify({
              title: t("game.settings.updated"),
              icon: "i-solar-info-circle-bold-duotone",
              color: "primary",
              duration: 3000,
            });
          }
        }
      },
    );
  };

  /**
   * Sets up all real-time subscriptions for the given lobby.
   * Call this after joining/loading a lobby.
   */
  const setupRealtime = async (lobbyData: Lobby) => {
    if (!client || !databases) return;
    const config = useRuntimeConfig();
    const lobbyId = lobbyData.$id;

    // Initial player fetch
    players.value = await getPlayersForLobby(lobbyId);

    // Fetch game settings
    try {
      const settings = await getGameSettings(lobbyId);
      if (!settings && isHost.value) {
        gameSettings.value = await createDefaultGameSettings(
          lobbyId,
          `${userStore.user?.name || "Anonymous"}'s Game`,
          userStore.user?.$id,
        );
      } else {
        gameSettings.value = settings;
      }

      const unsubscribeGameSettings = setupGameSettingsRealtime(lobbyId);
      if (unsubscribeGameSettings) {
        cleanupFunctions.push(unsubscribeGameSettings);
      }
    } catch (err) {
      console.error("Failed to load game settings:", err);
    }

    // 🧠 Lobby Realtime
    const unsubscribeLobby = client.subscribe(
      [
        `databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwriteLobbyCollectionId}.documents.${lobbyData.$id}`,
      ],
      async ({ events, payload }: { events: string[]; payload: unknown }) => {
        if (events.some((e: string) => e.endsWith(".delete"))) {
          notify({
            title: t("lobby.lobbydeleted"),
            color: "error",
            icon: "i-mdi-alert-circle",
          });
          await router.replace("/");
        }

        if (events.some((e: string) => e.endsWith(".update"))) {
          lobby.value = { ...(payload as Lobby) };
        }
      },
    );
    cleanupFunctions.push(unsubscribeLobby);

    // 👥 Player Realtime
    const playersTopic = `databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwritePlayerCollectionId}.documents`;

    const handleJoinNotification = async (player: Player) => {
      await playSfx(SFX.playerJoin);
      notify({
        title: t("lobby.player_joined", { name: player.name }),
        color: "success",
        icon: "i-mdi-account-plus",
      });
      // Bot system messages are created server-side in /api/bot/add
      // Only send client-side system message for human players
      if (isHost.value && player.playerType !== "bot") {
        await sendSystemMessage(
          lobbyId,
          t("lobby.player_joined", { name: player.name }),
        );
      }
    };

    const debouncedLeaveNotification = debounce(async (player: Player) => {
      await playSfx(SFX.playerJoin, { pitch: 0.8 });
      notify({
        title: t("lobby.player_left", { name: player.name }),
        color: "warning",
        icon: "i-mdi-account-remove",
      });
      // Bot system messages are created server-side in /api/bot/remove
      // Only send client-side system message for human players
      if (isHost.value && player.playerType !== "bot") {
        await sendSystemMessage(
          lobbyId,
          t("lobby.player_left", { name: player.name }),
        );
      }
    }, LEAVE_DEBOUNCE_TIME);

    const unsubscribePlayers = client.subscribe(
      [playersTopic],
      async ({ events, payload }: { events: string[]; payload: unknown }) => {
        const player = payload as Player;

        if (!player || !player.userId || !player.lobbyId || !player.name) {
          console.error("Invalid player object in event:", player);
          return;
        }

        const eventType = events[0]?.split(".").pop();
        const eventKey = `${player.userId}-${eventType}-${player.lobbyId}`;

        const now = Date.now();
        const recentEvent = recentPlayerEvents.get(eventKey);
        if (recentEvent && now - recentEvent < LEAVE_DEBOUNCE_TIME) {
          return;
        }

        recentPlayerEvents.set(eventKey, now);

        // Prune stale events
        for (const [key, timeStamp] of recentPlayerEvents.entries()) {
          if (now - timeStamp > LEAVE_DEBOUNCE_TIME) {
            recentPlayerEvents.delete(key);
          }
        }

        // Cap the map size
        if (recentPlayerEvents.size > 100) {
          console.warn("Too many recent player events, clearing oldest events");
          const entries = Array.from(recentPlayerEvents.entries());
          entries.sort((a, b) => b[1] - a[1]);
          recentPlayerEvents.clear();
          entries.slice(0, 50).forEach(([key, timeStamp]) => {
            recentPlayerEvents.set(key, timeStamp);
          });
        }

        const isCreate = events.some((e: string) => e.endsWith(".create"));
        const playerLobbyId = resolveId(player.lobbyId);

        if (
          isCreate &&
          playerLobbyId === lobbyId &&
          player.userId !== userStore.user?.$id
        ) {
          handleJoinNotification(player);
        }

        const isDelete = events.some(
          (e: string) =>
            e.endsWith(".delete") &&
            e.includes(config.public.appwritePlayerCollectionId as string),
        );
        if (
          isDelete &&
          playerLobbyId === lobbyId &&
          player.userId !== userStore.user?.$id
        ) {
          const isPlayerInList = players.value.some(
            (p) => p.userId === player.userId,
          );
          if (isPlayerInList) {
            debouncedLeaveNotification(player);
          }
        }

        if (isDelete && (payload as Player).userId === userStore.user!.$id) {
          if (selfLeaving.value) {
            notify({
              title: t("lobby.you_left"),
              color: "info",
              icon: "i-mdi-exit-run",
            });
          } else {
            notify({
              title: t("lobby.you_were_kicked"),
              color: "error",
              icon: "i-mdi-account-remove",
            });
          }
          selfLeaving.value = false;
          return router.replace("/");
        }

        if (playerLobbyId === lobbyId) {
          players.value = await getPlayersForLobby(lobbyId);
        }
      },
    );
    cleanupFunctions.push(unsubscribePlayers);

    // 🃏 Game Cards Realtime
    const gameCardsUnsubscribe = subscribeToGameCards(lobbyId);
    cleanupFunctions.push(gameCardsUnsubscribe);
  };

  return {
    setupRealtime,
  };
}
