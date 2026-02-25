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

const { hasReturnedToLobby, autoReturnTimeRemaining, handleContinue } =
  useAutoReturn({
    state,
    myId,
    isComplete,
    isHost,
    lobbyRef: lobby,
  });

// ─── Delayed Complete Gate ──────────────────────────────────────────────────
// When someone wins the final round, the server sets phase="complete" instantly.
// Delay the GameOver screen so the winning card celebration plays out first
// (2s card highlight + 5s celebration overlay = 7s total).
const delayedComplete = ref(false);
let delayedCompleteTimeout: ReturnType<typeof setTimeout> | null = null;

watch(isComplete, (complete) => {
  if (complete) {
    delayedCompleteTimeout = setTimeout(() => {
      delayedComplete.value = true;
    }, 7000);
  } else {
    delayedComplete.value = false;
    if (delayedCompleteTimeout) {
      clearTimeout(delayedCompleteTimeout);
      delayedCompleteTimeout = null;
    }
  }
});

const { convertToPlayer } = useSpectatorConversion({
  isHost,
  players,
  lobbyRef: lobby,
  state,
  getPlayerName,
});

// ─── Bot Orchestration ──────────────────────────────────────────────────────
const { removeOneBot, botPlayers } = useBots(lobby, players, isHost);

// When a new real player joins during waiting, remove one bot to make room
let previousRealPlayerCount = 0;
watch(
  players,
  (newPlayers) => {
    if (!isHost.value || !lobby.value || lobby.value.status !== "waiting")
      return;
    const realPlayers = newPlayers.filter((p) => p.playerType !== "bot");
    if (
      previousRealPlayerCount > 0 &&
      realPlayers.length > previousRealPlayerCount &&
      botPlayers.value.length > 0
    ) {
      removeOneBot();
    }
    previousRealPlayerCount = realPlayers.length;
  },
  { immediate: true },
);

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
  ],
  link: [{ rel: "canonical", href: `${config.public.baseUrl}/game/${code}` }],
});
// ─── Sidebar Watcher ────────────────────────────────────────────────────────
// Desktop sidebar can be toggled. Auto-collapse when game starts, but allow user to re-open.
const showDesktopSidebar = ref(true);
watch(isPlaying, (newIsPlaying) => {
  if (newIsPlaying) {
    // Auto-collapse both mobile and desktop sidebars when game starts
    isSidebarOpen.value = false;
    showDesktopSidebar.value = false;
  } else {
    // Re-show sidebar when game ends
    showDesktopSidebar.value = true;
  }
});

function toggleDesktopSidebar() {
  showDesktopSidebar.value = !showDesktopSidebar.value;
}

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
      body: { lobbyId: lobby.value.$id, playerId, userId: userStore.user?.$id },
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

async function handleSkipJudge() {
  if (!lobby.value) return;
  try {
    await $fetch("/api/game/skip-judge", {
      method: "POST",
      body: { lobbyId: lobby.value.$id, userId: userStore.user?.$id },
    });
    const judgeName = getPlayerName(state.value?.judgeId || null);
    notify({
      title: `Judge ${judgeName} was skipped — no winner this round`,
      color: "warning",
      icon: "i-mdi-gavel",
      duration: 3000,
    });
  } catch (err: any) {
    console.error("Failed to skip judge:", err);
    notify({
      title: "Failed to skip judge",
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

      <!-- Desktop sidebar toggle button (visible during gameplay when sidebar is hidden) -->
      <Transition name="sidebar-toggle">
        <div
          v-if="!showDesktopSidebar && isPlaying"
          class="hidden xl:flex fixed left-4 top-4 z-50 sidebar-toggle-btn"
        >
          <UButton
            icon="i-solar-sidebar-minimalistic-bold-duotone"
            color="neutral"
            variant="soft"
            size="lg"
            aria-label="Toggle sidebar"
            @click="toggleDesktopSidebar"
          />
        </div>
      </Transition>

      <!-- Desktop sidebar backdrop (click to close) -->
      <Transition name="sidebar-backdrop">
        <div
          v-if="showDesktopSidebar && isPlaying"
          class="hidden xl:block fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px]"
          @click="showDesktopSidebar = false"
        />
      </Transition>

      <!-- Desktop sidebar (slides over content) -->
      <aside
        class="desktop-sidebar hidden xl:flex"
        :class="{ 'desktop-sidebar--open': showDesktopSidebar }"
      >
        <div class="sidebar-content-scroll">
          <!-- Close button when playing -->
          <div v-if="isPlaying" class="sidebar-close-row">
            <UButton
              icon="i-solar-close-square-bold-duotone"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Close sidebar"
              @click="showDesktopSidebar = false"
            />
          </div>
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
            @skip-judge="handleSkipJudge"
            @update:settings="handleSettingsUpdate"
          />
        </div>
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
              @skip-judge="handleSkipJudge"
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
            (isPlaying || isJudging || isRoundEnd || isComplete) &&
            !delayedComplete &&
            lobby &&
            players
          "
        >
          <GameBoard
            :lobby="lobby || {}"
            :players="players"
            @leave="handleLeave"
          />
        </ClientOnly>

        <!-- Game Over -->
        <ClientOnly
          v-if="delayedComplete && !hasReturnedToLobby && lobby && players"
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
      v-if="delayedComplete && hasReturnedToLobby && lobby && players"
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

    <!-- Winner celebration is now handled inline by GameTable/GameBoard -->

    <!-- Fallback -->
    <div v-if="!lobby">
      <p>{{ t("lobby.error_loading_gamestate") }}</p>
    </div>
  </div>
</template>

<style scoped>
/* ─── Desktop sidebar overlay ──────────────────────────────── */
.desktop-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 40;
  height: 100vh;
  width: 340px;
  max-width: 90vw;
  padding: 0;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
  overflow-x: hidden;
  /* Deep dark background — slightly lighter than the board */
  background: linear-gradient(
    180deg,
    rgba(10, 10, 24, 0.99) 0%,
    rgba(15, 15, 35, 0.98) 100%
  );
  /* Noise texture via pseudo — we'll use box-shadow trick instead */
  border-right: 1px solid rgba(139, 92, 246, 0.3);
  box-shadow:
    4px 0 40px rgba(0, 0, 0, 0.6),
    1px 0 0 rgba(139, 92, 246, 0.15),
    inset -1px 0 0 rgba(139, 92, 246, 0.08);
  transform: translateX(-100%);
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  /* Subtle scanline texture */
  background-image:
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.04) 2px,
      rgba(0, 0, 0, 0.04) 4px
    ),
    linear-gradient(
      180deg,
      rgba(10, 10, 24, 0.99) 0%,
      rgba(15, 15, 35, 0.98) 100%
    );
}

/* Scrollable inner content area */
.sidebar-content-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.85rem 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(139, 92, 246, 0.3) transparent;
}

.sidebar-content-scroll::-webkit-scrollbar {
  width: 4px;
}

.sidebar-content-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-content-scroll::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.3);
  border-radius: 99px;
}

.desktop-sidebar--open {
  transform: translateX(0);
}

/* ─── Close row (inside scroll, when playing) ───────────────── */
.sidebar-close-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: -0.25rem;
}

/* ─── Sidebar backdrop fade ───────────────────────────────── */
.sidebar-backdrop-enter-active,
.sidebar-backdrop-leave-active {
  transition: opacity 0.3s ease;
}
.sidebar-backdrop-enter-from,
.sidebar-backdrop-leave-to {
  opacity: 0;
}

/* ─── Toggle button ───────────────────────────────────────── */
.sidebar-toggle-btn {
  backdrop-filter: blur(8px);
  background: rgba(10, 10, 24, 0.85) !important;
  border: 1px solid rgba(139, 92, 246, 0.35) !important;
  box-shadow: 0 0 12px rgba(139, 92, 246, 0.2);
  transition: all 0.2s ease;
}

.sidebar-toggle-btn:hover {
  background: rgba(139, 92, 246, 0.15) !important;
  border-color: rgba(139, 92, 246, 0.6) !important;
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
}

.sidebar-toggle-enter-active,
.sidebar-toggle-leave-active {
  transition: all 0.3s ease;
}

.sidebar-toggle-enter-from,
.sidebar-toggle-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
</style>
