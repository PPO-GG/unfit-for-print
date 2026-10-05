<script lang="ts" setup>
import { onMounted, onBeforeUnmount, ref, watch, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStore } from "~/stores/userStore";
import { useLobby } from "~/composables/useLobby";
import { useGameWatchdog } from "~/composables/useGameWatchdog";
import { useNotifications } from "~/composables/useNotifications";
import { useJoinLobby } from "~/composables/useJoinLobby";
import { useDynamicFavicon } from "~/composables/useDynamicFavicon";
import { useAutoReturn, CELEBRATION_MS } from "~/composables/useAutoReturn";
import { useSpectatorConversion } from "~/composables/useSpectatorConversion";
import { useSfx } from "~/composables/useSfx";
import GameOver from "~/components/game/GameOver.vue";
import type { Lobby } from "~/types/lobby";
import type { Player } from "~/types/player";
import { useI18n } from "vue-i18n";
import { kickedMetaKey } from "~/utils/kickedPlayers";
import { decideLobbyEntry } from "~/utils/lobbyEntry";
import { useCompactLayout } from "~/composables/useCompactLayout";

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
  lobbyDoc,
  reactive,
  engine,
  mutations,
  resetGameState,
  restoreLobbyDoc,
  waitForSync,
} = useLobby();
const { initializeGamePageSession } = useJoinLobby();

// Host-only watchdog for rounds that wedge without throwing. It observes and
// reports; it changes no game state, so it belongs here rather than in the
// engine.
useGameWatchdog(reactive);

// Phones get the podium on its own: its Continue leads to the lobby, which has
// Leave, so the old sidebar's hamburger would only sit on top of it.
const { isCompact } = useCompactLayout();

// ─── Reactive State from Y.Doc ──────────────────────────────────────────────
// All game state is derived from useLobbyReactive().
const {
  isPlaying,
  isWaiting,
  isComplete,
  isJudging,
  isSubmitting,
  isJudge,
  leaderboard,
  isRoundEnd,
  myId,
  mySubmission,
  isHost,
} = reactive;

// Wrap the Y.Doc gameState ref in a computed so it satisfies ComputedRef<>
// expected by useDynamicFavicon, useAutoReturn, useSpectatorConversion.
const state = computed(() => reactive.gameState.value);

// ─── Discord Rich Presence ──────────────────────────────────────────────────
useDiscordPresence({
  phase: computed(() => reactive.gameState.value?.phase ?? "waiting"),
  round: computed(() => reactive.gameState.value?.round ?? 0),
  playerCount: computed(() => reactive.playerList.value?.length ?? 0),
});

// ─── Sync players from Y.Doc ────────────────────────────────────────────────
watch(
  () => reactive.playerList.value,
  (v) => {
    players.value = v;
  },
  { immediate: true },
);

// ─── Sync lobby ref from Y.Doc meta ────────────────────────────────────────
// Keep the legacy lobby ref fresh with host/status changes from the Y.Doc.
watch(
  () => reactive.meta.value,
  (meta) => {
    if (!meta) return;
    if (lobby.value) {
      lobby.value = {
        ...lobby.value,
        hostUserId: meta.hostUserId || lobby.value.hostUserId,
        status: meta.status || lobby.value.status,
      };
    }
  },
  { immediate: true },
);

// ─── Kicked ─────────────────────────────────────────────────────────────────
// The host's client leaves a marker when it kicks someone (utils/kickedPlayers.ts).
// Gated on joinedLobby: a marker left from an earlier kick must not bounce a
// player who is back on the join form, and rejoining clears it anyway.
function sendHomeKicked() {
  selfLeaving.value = true;
  notify({
    title: t("lobby.you_were_kicked"),
    color: "warning",
    icon: "i-mdi-account-remove",
  });
  lobbyDoc.disconnect();
  return router.replace("/");
}

watch(
  () =>
    joinedLobby.value && myId.value
      ? reactive.meta.value?.kickedAt[myId.value]
      : undefined,
  (kickedAt) => {
    if (kickedAt && !selfLeaving.value) sendHomeKicked();
  },
);

// The Y.Doc status and isPrivate mirrors that used to live here are gone.
// They only ran in the HOST's browser tab, so a host closing their tab left
// the lobby row stale until the sweeper caught it. Both are now derived
// server-side from the live docs — see server/utils/reconcileLobbies.ts,
// called by /api/lobby/list and the lobby sweeper.

// ─── Dynamic Favicon ──────────────────────────────────────────────────────
useDynamicFavicon({
  state,
  isJudge,
  isSubmitting,
  isJudging,
  isRoundEnd,
  isComplete,
  hasSubmitted: computed(() => mySubmission.value !== null),
});

const { hasReturnedToLobby, podiumSecondsLeft, handleContinue } =
  useAutoReturn({
    state,
    myId,
    isComplete,
    isHost,
    lobbyRef: lobby,
    lobbyDoc,
    resetGame: () => lobby.value && resetGameState(lobby.value.id),
  });

// ─── Delayed Complete Gate ──────────────────────────────────────────────────
// When someone wins the final round, the server sets phase="complete" instantly.
// Delay the GameOver screen so the winning card celebration plays out first
// (2s card highlight + 5s celebration overlay = CELEBRATION_MS).
const delayedComplete = ref(false);
let delayedCompleteTimeout: ReturnType<typeof setTimeout> | null = null;

watch(isComplete, (complete) => {
  if (complete) {
    delayedCompleteTimeout = setTimeout(() => {
      delayedComplete.value = true;
    }, CELEBRATION_MS);
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

// The host left and no signed-in player could take over, so the lobby is
// gone (only a signed-in account may host). The leaving host's client wrote
// this; everyone still here goes home.
watch(
  () => reactive.meta.value?.closedAt,
  (closedAt) => {
    if (!closedAt || selfLeaving.value) return;
    selfLeaving.value = true;
    notify({
      title: t("lobby.closed_host_left"),
      color: "info",
      icon: "i-mdi-door-closed",
    });
    lobbyDoc.disconnect();
    router.replace("/");
  },
);

nuxtApp.payload.state.selfLeaving = false;
watch(
  () => nuxtApp.payload.state.selfLeaving,
  (v) => {
    if (v !== undefined) selfLeaving.value = v;
  },
  { immediate: true },
);

// ─── SEO (SSR-friendly via useAsyncData) ────────────────────────────────────
const { data: lobbyMeta } = await useAsyncData(`lobby-meta-${code}`, () =>
  $fetch<{
    lobbyName?: string | null;
    hostName?: string | null;
    code?: string;
  }>(`/api/lobby/${code}`),
);

const ogTitle = computed(() => {
  const name = lobbyMeta.value?.lobbyName;
  const base = name
    ? `${name} | Unfit for Print`
    : `Unfit for Print – Game ${code}`;

  // During gameplay, prefix with round info for the browser tab
  const round = state.value?.round;
  const phase = state.value?.phase;
  if (round && phase && phase !== "waiting" && phase !== "complete") {
    const phaseLabel =
      isJudge.value && phase === "judging"
        ? "Your Pick!"
        : phase === "submitting" && mySubmission.value === null
          ? "Your Turn!"
          : phase === "judging"
            ? "Judging..."
            : phase === "roundEnd"
              ? "Round Over"
              : "";
    return phaseLabel
      ? `${phaseLabel} R${round} | ${name || "Unfit for Print"}`
      : `Round ${round} | ${base}`;
  }
  if (phase === "complete") return `Game Over | ${name || "Unfit for Print"}`;

  return base;
});

const ogDescription = computed(() => {
  const host = lobbyMeta.value?.hostName;
  const name = lobbyMeta.value?.lobbyName;
  if (name && host)
    return `Join "${name}" — Hosted by ${host}. A hilarious Cards Against Humanity-style party game!`;
  if (name)
    return `Join "${name}" — A hilarious Cards Against Humanity-style party game!`;
  if (host)
    return `Hosted by ${host}. Join this lobby and play Unfit for Print with friends!`;
  return "A hilarious and chaotic web game. Join this lobby and play with friends!";
});

// Static title for OG meta (crawlers shouldn't see "Your Turn! R3")
const ogTitleStatic = computed(() => {
  const name = lobbyMeta.value?.lobbyName;
  return name ? `${name} | Unfit for Print` : `Unfit for Print – Game ${code}`;
});

// Lobbies are noindex (routeRules in nuxt.config.ts) but still get link
// previews, so the OG tags stay. The titles already carry the site name.
useHead({
  title: ogTitle,
  titleTemplate: "%s",
  // A pull-to-refresh mid-game drops the Yjs connection. Element-level
  // overscroll-behavior does nothing on overflow:hidden roots, so set it on <html>.
  htmlAttrs: { style: "overscroll-behavior: none" },
});
useSeoMeta({
  description: ogDescription,
  ogTitle: ogTitleStatic,
  ogDescription,
});
// ─── Sidebar Watcher ────────────────────────────────────────────────────────
// Desktop sidebar can be toggled. Auto-collapse when game starts, but allow user to re-open.
// The re-open is debounced to prevent visual flapping during transient
// Teleportal reconnects (Y.Doc state briefly nulls → isPlaying flickers false).
const showDesktopSidebar = ref(true);
let sidebarReopenTimer: ReturnType<typeof setTimeout> | null = null;

watch(isPlaying, (newIsPlaying) => {
  // Always cancel any pending re-open when isPlaying changes
  if (sidebarReopenTimer) {
    clearTimeout(sidebarReopenTimer);
    sidebarReopenTimer = null;
  }

  if (newIsPlaying) {
    // Auto-collapse both mobile and desktop sidebars when game starts
    isSidebarOpen.value = false;
    showDesktopSidebar.value = false;
  } else {
    // Delay sidebar restoration to survive transient Y.Doc reconnect flickers.
    // If isPlaying flips back to true within 500ms, the timer is cancelled above.
    sidebarReopenTimer = setTimeout(() => {
      showDesktopSidebar.value = true;
      sidebarReopenTimer = null;
    }, 500);
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
  loading.value = true;

  try {
    await initializeGamePageSession();

    const user = userStore.user;
    if (!user) {
      showJoinModal.value = true;
      return;
    }


    const fetchedLobby = await getLobbyByCode(code);
    if (!fetchedLobby) {
      notify({
        title: t("lobby.not_found"),
        color: "error",
        icon: "i-mdi-alert-circle",
      });
      return router.replace("/");
    }

    try {
      const fetchedLobbyData = await $fetch<Lobby>(`/api/lobby/${code}`);
      const meta = reactive.meta.value;
      lobby.value = {
        ...fetchedLobbyData,
        hostUserId: meta?.hostUserId || fetchedLobbyData.hostUserId,
        status: meta?.status || fetchedLobbyData.status,
      };
    } catch (error) {
      console.error("Failed to fetch lobby data:", error);
    }

    // ── Who is this visitor? ─────────────────────────────────────────
    // The server's player rows decide membership (utils/lobbyEntry.ts); the
    // doc is only checked first because it is cheaper. It has to be synced
    // before it can answer: connect() resolves before the server's state
    // arrives, and an unsynced doc has nobody in it.
    if (lobbyDoc.lobbyCode.value !== code) {
      await lobbyDoc.connect(code);
    }
    await waitForSync();

    const meta = lobbyDoc.getMeta();
    const inDoc = !!lobbyDoc.getPlayers().get(user.id);
    const activeLobby = inDoc ? null : await getActiveLobbyForUser(user.id);
    const entry = decideLobbyEntry({
      inDoc,
      seatedHere: activeLobby?.id === fetchedLobby.id,
      seatedElsewhere: !!activeLobby && activeLobby.code !== code,
      kicked: !!meta.get(kickedMetaKey(user.id)),
      docInitialized: !!meta.get("hostUserId"),
      isHost: fetchedLobby.hostUserId === user.id,
    });

    if (entry === "join") {
      showJoinModal.value = true;
      return;
    }
    if (entry === "redirect") {
      notify({
        title: t("lobby.return_active_game"),
        color: "info",
        icon: "i-mdi-controller",
      });
      return router.replace(`/game/${activeLobby!.code}`);
    }
    if (entry === "kicked") return sendHomeKicked();
    if (entry === "rebuild") {
      // The sync server dropped the doc; the host gets their lobby back.
      await restoreLobbyDoc(fetchedLobby);
    } else if (entry === "rejoin") {
      // Seated on the server, missing from the doc: a refresh that beat the
      // doc, or a doc the sync server dropped.
      try {
        const docStatus = meta.get("status") || "waiting";
        mutations.addPlayer({
          userId: user.id,
          name: user.name || "Unknown",
          avatar: user.avatarUrl || "",
          isHost: meta.get("hostUserId") === user.id,
          joinedAt: new Date().toISOString(),
          provider: user.discordUserId ? "discord" : "anonymous",
          playerType: docStatus === "playing" ? "spectator" : "player",
          activeDecoration: user.activeDecoration || "",
        });
      } catch (err) {
        console.warn("[GamePage] Failed to re-add player to Y.Doc:", err);
      }
    }

    lobby.value = fetchedLobby;
    joinedLobby.value = true;
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

// ─── Cleanup on Navigation Away ─────────────────────────────────────────────
// If the user navigates away (back button, route change, etc.) without
// explicitly leaving via handleLeave, tear down the Y.Doc connection so the
// Teleportal server doesn't retain ghost clients and stale documents.
onBeforeUnmount(() => {
  if (sidebarReopenTimer) {
    clearTimeout(sidebarReopenTimer);
    sidebarReopenTimer = null;
  }
  if (!selfLeaving.value && lobbyDoc.connected.value) {
    console.log("[GamePage] Unmounting — disconnecting lobby Y.Doc");
    lobbyDoc.disconnect();
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

  // Connect to Y.Doc (joinLobby may already connect, but ensure it)
  if (lobbyDoc.lobbyCode.value !== joinedCode) {
    await lobbyDoc.connect(joinedCode);
  }

  showJoinModal.value = false;
  joinedLobby.value = true;
};

// The card closes itself shortly after a join; only a close without one means
// the visitor backed out, and there is nothing on this page for them then.
let joinedFromCard = false;
function onJoinCardJoined(joinedCode: string) {
  joinedFromCard = true;
  handleJoinSuccess(joinedCode);
}
function onJoinCardOpen(open: boolean) {
  if (open || joinedFromCard) return;
  router.replace("/");
}

const handleLeave = async () => {
  if (!lobby.value || !userStore.user?.id) return;
  selfLeaving.value = true;
  await leaveLobby(lobby.value.id, userStore.user.id);
  // Discord Activity users return to VC Hub; others go home
  return router.replace("/");
};

const startGameWrapper = async () => {
  if (!lobby.value) return;

  try {
    isStarting.value = true;
    const s = reactive.settings.value;
    if (!s) return;
    await startGame(lobby.value.id, {
      maxPoints: s.maxPoints,
      numPlayerCards: s.cardsPerPlayer,
      cardPacks: s.cardPacks,
      isPrivate: s.isPrivate,
      lobbyName: s.lobbyName,
      maxPick: s.maxPick,
    });
  } catch (err) {
    console.error("Failed to start game:", err);
    isStarting.value = false;
  }
};

function copyLobbyLink() {
  if (typeof window === "undefined" || !navigator.clipboard) {
    notify({
      title: t("lobby.error_code_copied"),
      color: "error",
      icon: "i-mdi-alert-circle",
    });
    return;
  }
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

function handleSkipPlayer(playerId: string) {
  if (!lobby.value) return;
  const result = engine.skipPlayer(playerId);
  if (result.success) {
    const playerName = getPlayerName(playerId);
    notify({
      title: t("game.player_was_skipped", { name: playerName }),
      color: "warning",
      icon: "i-mdi-skip-next",
      duration: 3000,
    });
  } else {
    console.error("Failed to skip player:", result.reason);
    notify({
      title: t("game.skip_player_failed"),
      color: "error",
      icon: "i-mdi-alert-circle",
    });
  }
}

function handleSkipJudge() {
  if (!lobby.value) return;
  const result = engine.skipJudge();
  if (result.success) {
    const judgeName = getPlayerName(state.value?.judgeId || null);
    notify({
      title: `Judge ${judgeName} was skipped — no winner this round`,
      color: "warning",
      icon: "i-mdi-gavel",
      duration: 3000,
    });
  } else {
    console.error("Failed to skip judge:", result.reason);
    notify({
      title: "Failed to skip judge",
      color: "error",
      icon: "i-mdi-alert-circle",
    });
  }
}

function handleResetGame() {
  if (!isHost.value || !lobby.value) return;
  resetGameState(lobby.value.id);
  isStarting.value = false;
  notify({
    title: t("game.reset_to_lobby_success"),
    color: "success",
    icon: "i-solar-restart-bold-duotone",
    duration: 4000,
  });
}
</script>

<template>
  <div class="bg-slate-900 text-white">
    <!-- In-game loading overlay (waiting for lobby / Y.Doc init) -->
    <Transition name="page">
      <div
        v-if="loading"
        class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-900/90 backdrop-blur-sm"
      >
        <Icon
          name="svg-spinners:pulse-rings-multiple"
          size="64px"
          class="text-white"
        />
        <p class="text-white text-xl font-display tracking-wide">
          {{ t("game.loading_game") }}
        </p>
      </div>
    </Transition>

    <ConnectionBanner />

    <!-- Join card: a visitor without a seat here (usually an invite link)
         only adds a name — the code comes from the URL. -->
    <div v-if="showJoinModal" class="min-h-dvh">
      <JoinTakeover
        :open="showJoinModal"
        :initial-code="code"
        @joined="onJoinCardJoined"
        @update:open="onJoinCardOpen"
      />
    </div>

    <!-- Main game layout -->
    <div
      v-if="!showJoinModal && lobby && players"
      class="flex h-dvh overflow-hidden"
    >
      <!-- Tablet menu button (hidden during active gameplay — phones and gameplay have their own controls) -->
      <UButton
        v-if="!isPlaying && !isWaiting && !isCompact"
        icon="i-solar-hamburger-menu-broken"
        color="neutral"
        variant="ghost"
        size="xl"
        class="xl:hidden absolute left-6 translate-y-[50%] z-10"
        aria-label="Open menu"
        @click="isSidebarOpen = true"
      />

      <!-- Desktop sidebar toggle button (waiting room only — gameplay uses CornerControls) -->
      <Transition name="sidebar-toggle">
        <div
          v-if="!showDesktopSidebar && !isPlaying && !isWaiting"
          class="hidden xl:flex fixed left-4 top-4 z-[75] sidebar-toggle-btn"
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

      <!-- Desktop sidebar backdrop (waiting room only — gameplay uses ESC menu + FPS chat) -->
      <Transition name="sidebar-backdrop">
        <div
          v-if="showDesktopSidebar && !isPlaying && !isWaiting"
          class="hidden xl:block fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]"
          @click="showDesktopSidebar = false"
        />
      </Transition>

      <!-- Desktop sidebar (hidden during active gameplay and waiting phase) -->
      <aside
        v-if="!isPlaying && !isWaiting"
        class="desktop-sidebar hidden xl:flex"
        :class="{ 'desktop-sidebar--open': showDesktopSidebar }"
      >
        <div class="sidebar-content-scroll">
          <GameSidebarContent
            :lobby="lobby"
            :players="players"
            :state="state"
            :game-settings="reactive.settings.value"
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
            @reset-game="handleResetGame"
          />
        </div>
      </aside>

      <!-- Mobile slideover (hidden during active gameplay) -->
      <USlideover
        v-if="!isCompact"
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
              :game-settings="reactive.settings.value"
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
              @reset-game="handleResetGame"
              @close="isSidebarOpen = false"
            />
          </div>
        </template>
      </USlideover>

      <!-- Main content area -->
      <div class="flex-1">
        <!-- Waiting room. Also where a player who tapped "Back to lobby" on the
             podium waits for the rest; it lives here, inside the full-height
             layout, because a sibling after it rendered below the screen. -->
        <ClientOnly>
          <LobbyRoom
            v-if="(isWaiting || (delayedComplete && hasReturnedToLobby)) && lobby && players"
            :lobby="lobby"
            :players="players"
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
            @skip-judge="handleSkipJudge"
            @skip-player="handleSkipPlayer"
            @reset-game="handleResetGame"
          />
        </ClientOnly>

        <!-- Game Over -->
        <ClientOnly
          v-if="delayedComplete && !hasReturnedToLobby && lobby && players"
        >
          <GameOver
            :leaderboard="leaderboard"
            :players="players"
            :round="state?.round ?? 0"
            :goal="reactive.settings.value?.maxPoints ?? 10"
            :seconds-left="podiumSecondsLeft"
            @continue="handleContinue"
          />
        </ClientOnly>
      </div>
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
  z-index: 70;
  height: 100vh;
  height: 100dvh;
  width: 21.25rem;
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
