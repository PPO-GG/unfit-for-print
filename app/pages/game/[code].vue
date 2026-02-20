<script lang="ts" setup>
import { onMounted, ref, watch, computed, toRaw } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStore } from "~/stores/userStore";
import { useLobby } from "~/composables/useLobby";
import { usePlayers } from "~/composables/usePlayers";
import { useNotifications } from "~/composables/useNotifications";
import { useJoinLobby } from "~/composables/useJoinLobby";
import { useGameContext } from "~/composables/useGameContext";
import { isAuthenticatedUser } from "~/composables/useUserUtils";
import { useGameCards } from "~/composables/useGameCards";
import { useGameSettings } from "~/composables/useGameSettings";
import { useGameRealtime } from "~/composables/useGameRealtime";
import { useWinnerSelection } from "~/composables/useWinnerSelection";
import { useAutoReturn } from "~/composables/useAutoReturn";
import { useSpectatorConversion } from "~/composables/useSpectatorConversion";
import { useSfx } from "~/composables/useSfx";
import GameOver from "~/components/game/GameOver.vue";
import type { GameSettings as GameSettingsType } from "~/types/gamesettings";
import type { Lobby } from "~/types/lobby";
import type { Player } from "~/types/player";
import { useI18n } from "vue-i18n";

// ─── Core Setup ─────────────────────────────────────────────────────────────
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const userStore = useUserStore();
const nuxtApp = useNuxtApp();

definePageMeta({ layout: "game" });

const code = route.params.code as string;
const lobby = ref<Lobby | null>(null);
const players = ref<Player[]>([]);
const loading = ref(true);
const showJoinModal = ref(false);
const joinedLobby = ref(false);
const isStarting = ref(false);
const gameSettings = ref<GameSettingsType | null>(null);
const isSidebarOpen = ref(false);
const selfLeaving = ref(false);
const copied = ref(false);

// ─── Composables ────────────────────────────────────────────────────────────
const { notify } = useNotifications();
const { playSfx } = useSfx();
const {
  getLobbyByCode,
  leaveLobby,
  getActiveLobbyForUser,
  startGame,
  isInLobby,
} = useLobby();
const { getGameSettings, createDefaultGameSettings } = useGameSettings();
const { initSessionIfNeeded } = useJoinLobby();
const { playerHands, subscribeToGameCards } = useGameCards();

const {
  isPlaying,
  isWaiting,
  isComplete,
  isJudging,
  leaderboard,
  isRoundEnd,
  roundWinner,
  winningCards,
  roundEndStartTime,
  roundEndCountdownDuration,
  myId,
  state,
} = useGameContext(
  lobby,
  computed(() => playerHands.value),
);

// ─── Host Check ─────────────────────────────────────────────────────────────
const isHost = computed(() => {
  const hostId = lobby.value?.hostUserId;
  const userId = userStore.user?.$id;
  if (!hostId || !userId) return false;
  return hostId === userId;
});

// ─── Extracted Composables ──────────────────────────────────────────────────
const { setupRealtime } = useGameRealtime({
  lobby,
  players,
  gameSettings,
  isHost,
  selfLeaving,
  subscribeToGameCards,
});

const { effectiveRoundWinner, effectiveWinningCards, handleWinnerSelect } =
  useWinnerSelection({
    state,
    lobbyRef: lobby,
    roundWinner,
    winningCards,
  });

const { hasReturnedToLobby, autoReturnTimeRemaining, handleContinue } =
  useAutoReturn({
    state,
    myId,
    isComplete,
    lobbyRef: lobby,
  });

const { convertToPlayer } = useSpectatorConversion({
  isHost,
  players,
  lobbyRef: lobby,
  state,
  getPlayerName,
});

// ─── Payload State Sync (for layout access) ────────────────────────────────
watch(
  lobby,
  (v) => {
    if (v) nuxtApp.payload.state.lobby = v;
  },
  { immediate: true },
);
watch(
  players,
  (v) => {
    if (v) nuxtApp.payload.state.players = v;
  },
  { immediate: true },
);

nuxtApp.payload.state.selfLeaving = false;
watch(
  () => nuxtApp.payload.state.selfLeaving,
  (v) => {
    if (v !== undefined) selfLeaving.value = v;
  },
  { immediate: true },
);

// ─── SEO ────────────────────────────────────────────────────────────────────
useHead({
  title: `Unfit for Print | Game ${code}`,
  meta: [
    {
      name: "description",
      content:
        "Join the chaos in Unfit for Print – a Cards Against Humanity-inspired party game!",
    },
    { property: "og:site_name", content: "Unfit for Print" },
    { property: "og:title", content: `Unfit for Print - Game ${code}` },
    {
      property: "og:description",
      content: lobby.value?.hostUserId
        ? `Hosted by ${lobby.value?.hostUserId}`
        : "A hilarious and chaotic web game. Join this lobby and play with friends!",
    },
    { property: "og:type", content: "website" },
    { property: "og:url", content: `${config.public.baseUrl}/game/${code}` },
    {
      property: "og:image",
      content: `${config.public.baseUrl}/api/og?code=${code}`,
    },
    { property: "og:image:type", content: "image/png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
  ],
  link: [{ rel: "canonical", href: `${config.public.baseUrl}/game/${code}` }],
});

// ─── Sidebar Watcher ────────────────────────────────────────────────────────
watch(isPlaying, (newIsPlaying) => {
  if (newIsPlaying && isSidebarOpen.value) {
    isSidebarOpen.value = false;
  }
});

// ─── Player Name Resolution ─────────────────────────────────────────────────
/**
 * Synchronously resolves a player name using all available data sources.
 * 4-level fallback chain: direct match → state.players →
 * submission cross-ref → current user → "Unknown Player".
 *
 * Uses strict equality (`===`) for all ID comparisons.
 */
function getPlayerName(playerId: string | null): string {
  if (!playerId || playerId === "") return t("lobby.unknown_player");

  // 1. Direct match in the players list
  const player = players.value.find((p) => p.userId === playerId);
  if (player?.name) return player.name;

  // 2. Check state.players map (stored during game)
  if (state.value?.players?.[playerId]) {
    return state.value.players[playerId];
  }

  // 3. Cross-reference via submission keys → players list
  if (state.value?.submissions) {
    for (const submissionPlayerId of Object.keys(state.value.submissions)) {
      if (submissionPlayerId === playerId) {
        const matchingPlayer = players.value.find(
          (p) => p.userId === submissionPlayerId,
        );
        if (matchingPlayer?.name) return matchingPlayer.name;
      }
    }
  }

  // 4. Check if this is the current user
  if (myId.value && myId.value === playerId) {
    return t("game.you");
  }

  return t("lobby.unknown_player");
}

// ─── Page Lifecycle ─────────────────────────────────────────────────────────
onMounted(async () => {
  const { isMobile } = useDevice();
  const { isSizeMobile } = useDeviceType();
  if ((isSizeMobile || isMobile) && isWaiting) {
    isSidebarOpen.value = true;
  }
  loading.value = true;

  try {
    await initSessionIfNeeded();
    await userStore.fetchUserSession();

    const user = userStore.user;
    if (!user) {
      showJoinModal.value = true;
      return;
    }

    const isCreator =
      route.query.creator === "true" && isAuthenticatedUser(user);

    const fetchedLobby = await getLobbyByCode(code);
    if (!fetchedLobby) {
      notify({
        title: t("lobby.not_found"),
        color: "error",
        icon: "i-mdi-alert-circle",
      });
      return router.replace("/join?error=not_found");
    }

    try {
      lobby.value = await $fetch<Lobby>(`/api/lobby/${code}`);
    } catch (error) {
      console.error("Failed to fetch lobby data:", error);
    }

    if (!isCreator) {
      const activeLobby = await getActiveLobbyForUser(user.$id);
      if (activeLobby && activeLobby.code === code) {
        // Already in this lobby — proceed
      } else if (activeLobby) {
        notify({
          title: t("lobby.return_active_game"),
          color: "info",
          icon: "i-mdi-controller",
        });
        return router.replace(`/game/${activeLobby.code}`);
      } else {
        // No active lobby found — check if this is a page refresh
        // and user is still actually in this lobby
        const stillInLobby = fetchedLobby
          ? await isInLobby(user.$id, fetchedLobby.$id)
          : false;

        if (!stillInLobby) {
          // User has no player doc for this lobby — must join first
          showJoinModal.value = true;
          return;
        }
        // User is in fact in this lobby (e.g. page refresh) — proceed
      }
    }

    lobby.value = fetchedLobby;
    joinedLobby.value = true;
    await setupRealtime(fetchedLobby);
  } catch (err) {
    console.error(err);
    notify({
      title: t("lobby.failed_loading_game"),
      color: "error",
      icon: "i-mdi-alert-circle",
    });
    await router.replace("/");
  } finally {
    loading.value = false;
  }
});

// ─── Event Handlers ─────────────────────────────────────────────────────────
const handleJoinSuccess = async (joinedCode: string) => {
  const fetchedLobby = await getLobbyByCode(joinedCode);
  if (!fetchedLobby) {
    notify({
      title: t("lobby.not_found"),
      color: "error",
      icon: "i-mdi-alert-circle",
    });
    return;
  }
  lobby.value = fetchedLobby;
  await setupRealtime(fetchedLobby);
  showJoinModal.value = false;
  joinedLobby.value = true;
};

const handleLeave = async () => {
  if (!lobby.value || !userStore.user?.$id) return;
  selfLeaving.value = true;
  await leaveLobby(lobby.value.$id, userStore.user.$id);
  return router.replace("/");
};

const handleRoundStarted = async () => {
  if (lobby.value?.$id) {
    await $fetch<Lobby>(`/api/lobby/${code}`)
      .then((updatedLobby) => {
        if (updatedLobby) lobby.value = updatedLobby;
      })
      .catch((err) => {
        console.error("Failed to refresh lobby data:", err);
      });
    playSfx("nextRound");
  }
};

const handleSettingsUpdate = (newSettings: GameSettingsType) => {
  gameSettings.value = newSettings;
};

const ensureGameSettings = async () => {
  if (!gameSettings.value || !gameSettings.value.$id) {
    try {
      const settings = await getGameSettings(lobby.value!.$id);
      if (!settings && isHost.value) {
        gameSettings.value = await createDefaultGameSettings(
          lobby.value!.$id,
          `${userStore.user?.name || "Anonymous"}'s Game`,
          userStore.user?.$id,
        );
      } else if (settings) {
        gameSettings.value = settings;
      } else {
        throw new Error("Could not initialize game settings");
      }
    } catch (err) {
      console.error("Failed to initialize game settings:", err);
      notify({
        title: t("lobby.settings_error"),
        description: t("lobby.settings_init_error"),
        color: "error",
        icon: "i-mdi-alert-circle",
      });
    }
  }
};

const startGameWrapper = async () => {
  if (!lobby.value) return;
  if (!gameSettings.value || !gameSettings.value.$id) {
    console.error("Game settings not properly initialized");
    notify({
      title: t("lobby.cant_start_game"),
      description: t("lobby.settings_init_error"),
      color: "error",
      icon: "i-mdi-alert-circle",
    });
    return;
  }

  try {
    isStarting.value = true;
    await ensureGameSettings();
    await startGame(lobby.value.$id, { ...toRaw(gameSettings.value) });
  } catch (err) {
    console.error("Failed to start game:", err);
    isStarting.value = false;
  }
};

function copyLobbyLink() {
  if (typeof window === "undefined") return;
  navigator.clipboard
    .writeText(config.public.baseUrl + "/game/" + lobby.value?.code)
    .then(() => {
      notify({
        title: t("lobby.code_copied"),
        color: "success",
        icon: "i-mdi-clipboard-check",
      });
    })
    .catch((err) => {
      console.error("Failed to copy lobby code:", err);
      notify({
        title: t("lobby.error_code_copied"),
        color: "error",
        icon: "i-mdi-alert-circle",
      });
    });
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}

async function handleSkipPlayer(playerId: string) {
  if (!lobby.value) return;
  try {
    await $fetch("/api/game/skip-player", {
      method: "POST",
      body: { lobbyId: lobby.value.$id, playerId },
    });
    const playerName = getPlayerName(playerId);
    notify({
      title: t("game.player_was_skipped", { name: playerName }),
      color: "warning",
      icon: "i-mdi-skip-next",
      duration: 3000,
    });
  } catch (err: any) {
    console.error("Failed to skip player:", err);
    notify({
      title: t("game.skip_player_failed"),
      color: "error",
      icon: "i-mdi-alert-circle",
    });
  }
}
</script>

<template>
  <div class="bg-slate-900 text-white">
    <LoadingOverlay :is-loading="loading" :message="t('game.loading_game')" />

    <!-- Join modal -->
    <div
      v-if="showJoinModal"
      class="flex flex-col justify-center items-center min-h-screen"
    >
      <JoinLobbyForm :initial-code="code" @joined="handleJoinSuccess" />
    </div>

    <!-- Main game layout -->
    <div
      v-if="!showJoinModal && lobby && players"
      class="flex h-screen overflow-hidden"
    >
      <!-- Mobile menu button -->
      <UButton
        icon="i-solar-hamburger-menu-broken"
        color="neutral"
        variant="ghost"
        size="xl"
        class="xl:hidden absolute left-6 translate-y-[50%] z-10"
        aria-label="Open menu"
        @click="isSidebarOpen = true"
      />

      <!-- Desktop sidebar -->
      <aside
        class="max-w-1/4 w-auto h-screen p-4 flex-col shadow-inner border-r border-slate-800 bg-slate-900 space-y-4 overflow-scroll hidden xl:flex z-10"
      >
        <GameSidebarContent
          :lobby="lobby"
          :players="players"
          :state="state"
          :game-settings="gameSettings"
          :is-host="isHost"
          :is-starting="isStarting"
          :is-waiting="isWaiting"
          :joined-lobby="joinedLobby"
          :my-id="myId"
          :copied="copied"
          @copy-link="copyLobbyLink"
          @leave="handleLeave"
          @start-game="startGameWrapper"
          @convert-spectator="convertToPlayer"
          @skip-player="handleSkipPlayer"
          @update:settings="handleSettingsUpdate"
        />
      </aside>

      <!-- Mobile slideover -->
      <USlideover
        v-model:open="isSidebarOpen"
        class="xl:hidden"
        side="left"
        :overlay="false"
        title="Game Menu"
        description="Game sidebar with players, settings, and actions"
      >
        <template #content>
          <div class="p-4 flex flex-col h-full space-y-4 overflow-auto">
            <GameSidebarContent
              mobile
              :lobby="lobby"
              :players="players"
              :state="state"
              :game-settings="gameSettings"
              :is-host="isHost"
              :is-starting="isStarting"
              :is-waiting="isWaiting"
              :joined-lobby="joinedLobby"
              :my-id="myId"
              :copied="copied"
              @copy-link="copyLobbyLink"
              @leave="handleLeave"
              @start-game="startGameWrapper"
              @convert-spectator="convertToPlayer"
              @skip-player="handleSkipPlayer"
              @update:settings="handleSettingsUpdate"
              @close="isSidebarOpen = false"
            />
          </div>
        </template>
      </USlideover>

      <!-- Main content area -->
      <div class="flex-1">
        <!-- Waiting room -->
        <ClientOnly>
          <WaitingRoom
            v-if="isWaiting && lobby && players"
            :lobby="lobby || {}"
            :players="players"
            :sidebar-moved="true"
            @leave="handleLeave"
          />
        </ClientOnly>

        <!-- In-game -->
        <ClientOnly
          v-if="
            (isPlaying || isJudging || isRoundEnd) &&
            !isComplete &&
            lobby &&
            players
          "
        >
          <GameBoard
            :lobby="lobby || {}"
            :players="players"
            :white-card-texts="{}"
            @leave="handleLeave"
            @select-winner="handleWinnerSelect"
          />
        </ClientOnly>

        <!-- Game Over -->
        <ClientOnly
          v-if="isComplete && !hasReturnedToLobby && lobby && players"
        >
          <GameOver
            :leaderboard="leaderboard"
            :players="players"
            @continue="handleContinue"
          />
        </ClientOnly>
      </div>
    </div>

    <!-- Post-game waiting room -->
    <div
      v-if="isComplete && hasReturnedToLobby && lobby && players"
      class="flex-1"
    >
      <ClientOnly>
        <WaitingRoom
          :lobby="lobby || {}"
          :players="players"
          :sidebar-moved="true"
          @leave="handleLeave"
        />
      </ClientOnly>
    </div>

    <!-- Round End Overlay -->
    <ClientOnly>
      <RoundEndOverlay
        v-if="isRoundEnd && lobby && !isComplete"
        :countdown-duration="roundEndCountdownDuration"
        :is-host="isHost"
        :is-winner-self="!!(myId && effectiveRoundWinner === myId)"
        :lobby-id="lobby?.$id || ''"
        :start-time="roundEndStartTime"
        :winner-name="getPlayerName(effectiveRoundWinner)"
        :document-id="
          gameSettings?.$id ||
          (lobby?.$id ? `settings-${lobby.$id}` : undefined)
        "
        :winning-cards="effectiveWinningCards"
        @round-started="handleRoundStarted"
      />
    </ClientOnly>

    <!-- Fallback -->
    <div v-if="!lobby">
      <p>{{ t("lobby.error_loading_gamestate") }}</p>
    </div>
  </div>
</template>
