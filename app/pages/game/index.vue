<template>
  <div class="flex flex-col items-center justify-start text-white">
    <!-- ── Hero Section ─────────────────────────────────────────── -->
    <div class="lobby-hero z-10 w-full px-6">
      <h1 class="lobby-title">
        {{ t("game.available") }}
      </h1>

      <!-- Primary CTAs -->
      <div class="flex flex-wrap items-center justify-center gap-3">
        <UButton
          size="xl"
          variant="subtle"
          color="success"
          icon="i-solar-hand-shake-line-duotone"
          class="font-bold uppercase tracking-wider text-lg"
          @click="showJoin = true"
        >
          {{ t("modal.join_lobby") }}
        </UButton>

        <ClientOnly>
          <UButton
            v-if="showIfAuthenticated"
            size="xl"
            variant="subtle"
            color="warning"
            icon="i-solar-add-square-bold-duotone"
            class="font-bold uppercase tracking-wider text-lg"
            :loading="creatingLobby"
            @click="handleCreateLobby"
          >
            {{ t("modal.create_lobby") }}
          </UButton>
        </ClientOnly>
      </div>
    </div>

    <!-- ── Lobby Browser ─────────────────────────────────────────── -->
    <div class="w-full max-w-6xl px-4 pb-20 z-10">
      <!-- Section header -->
      <div class="flex items-center justify-between mb-4 px-1">
        <h2 class="text-xs font-bold uppercase tracking-widest text-slate-400">
          {{ t("game.available") }}
        </h2>
        <span
          class="text-xs font-bold uppercase tracking-widest text-slate-400 tabular-nums"
        >
          {{ sortedLobbies.length }}
          {{ sortedLobbies.length === 1 ? "lobby" : "lobbies" }}
        </span>
      </div>

      <!-- Lobby Grid -->
      <ul v-if="sortedLobbies.length" class="lobby-grid">
        <li
          v-for="lobby in sortedLobbies"
          :key="lobby.id"
          class="lobby-card"
          :class="{
            'lobby-card--waiting': (getLiveInfo(lobby.code)?.phase || lobby.status) === 'waiting',
            'lobby-card--complete': (getLiveInfo(lobby.code)?.phase || lobby.status) === 'complete',
          }"
          @click="handleJoined(lobby.code)"
        >
          <div class="lobby-card__accent" />

          <div class="lobby-card__topline">
            <span class="lobby-card__code">{{ lobby.code }}</span>
            <span
              class="lobby-card__status"
              :class="getStatusBadgeClasses(lobby, getLiveInfo(lobby.code))"
            >
              <span
                class="lobby-card__status-dot"
                :class="getStatusDotClass(lobby, getLiveInfo(lobby.code))"
              />
              {{ getStatusLabel(lobby, getLiveInfo(lobby.code)) }}
            </span>
          </div>

          <div class="lobby-card__title-row">
            <div class="lobby-card__host-avatar shrink-0">
              <img
                v-if="getHostAvatar(lobby)"
                :src="getHostAvatar(lobby)!"
                :alt="getHostName(lobby)"
                class="lobby-card__avatar-image"
              />
              <span
                v-else
                class="i-solar-users-group-rounded-bold-duotone text-xl"
              />
            </div>
            <div class="min-w-0">
              <h3 class="lobby-card__name truncate">
                {{ lobby.lobbyName || t("lobby.no_name") }}
              </h3>
              <p class="lobby-card__host truncate">
                <span class="i-solar-crown-minimalistic-bold-duotone" />
                Hosted by {{ getHostName(lobby) }}
              </p>
            </div>
          </div>

          <div class="lobby-card__seats" aria-label="Players in this lobby">
            <template v-if="getLiveInfo(lobby.code)">
              <span
                v-for="name in getLiveInfo(lobby.code)!.playerNames.slice(0, 6)"
                :key="name"
                class="lobby-card__seat"
                :title="name"
              >{{ name.charAt(0) || "?" }}</span>
              <span
                v-for="seat in Math.max(0, 6 - Math.min(getLiveInfo(lobby.code)!.players, 6))"
                :key="`empty-live-${seat}`"
                class="lobby-card__seat lobby-card__seat--empty"
              >+</span>
            </template>
            <template v-else>
              <span
                v-for="player in (lobbyPlayers[lobby.id] || []).slice(0, 6)"
                :key="player.$id"
                class="lobby-card__seat overflow-hidden"
                :title="player.name"
              >
                <img v-if="player.avatar" :src="player.avatar" :alt="player.name" />
                <template v-else>{{ player.name?.charAt(0) || "?" }}</template>
              </span>
              <span
                v-for="seat in Math.max(0, 6 - Math.min((lobbyPlayers[lobby.id] || []).length, 6))"
                :key="`empty-${seat}`"
                class="lobby-card__seat lobby-card__seat--empty"
              >+</span>
            </template>
          </div>

          <div class="lobby-card__footer">
            <div class="min-w-0 flex-1">
              <div class="lobby-card__meta">
                <span class="inline-flex items-center gap-1">
                  <span class="i-solar-users-group-rounded-bold-duotone" />
                  {{ getLiveInfo(lobby.code)?.players ?? lobbyPlayers[lobby.id]?.length ?? 0 }} players
                </span>
                <span v-if="getLiveInfo(lobby.code)?.round" class="tabular-nums">
                  Round {{ getLiveInfo(lobby.code)!.round }}
                </span>
              </div>
              <div class="lobby-card__meter" aria-hidden="true">
                <span :style="{ width: `${Math.min(100, ((getLiveInfo(lobby.code)?.players ?? lobbyPlayers[lobby.id]?.length ?? 0) / 6) * 100)}%` }" />
              </div>
            </div>

            <UButton
              size="sm"
              variant="solid"
              color="primary"
              icon="i-solar-arrow-right-bold-duotone"
              trailing
              class="lobby-card__join"
              @click.stop="handleJoined(lobby.code)"
            >
              {{ t("game.joingame") }}
            </UButton>
          </div>
        </li>
      </ul>

      <!-- Empty State -->
      <div
        v-else
        class="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-slate-900/50 backdrop-blur-md py-16 px-6 text-center"
      >
        <div
          class="flex items-center justify-center w-24 h-24 rounded-2xl bg-slate-700/40 border border-white/5 text-slate-500"
        >
          <Icon name="solar:ghost-bold-duotone" class="text-6xl" />
        </div>
        <div>
          <p class="text-xl font-semibold text-slate-300">
            {{ t("game.nogamesavailable") }}
          </p>
          <p class="text-md text-slate-500 mt-1">
            Create a lobby or join one directly with a code.
          </p>
        </div>
      </div>
    </div>

    <!-- ── Modals / Overlays ────────────────────────────────────── -->
    <JoinTakeover v-model:open="showJoin" @joined="handleJoined" />
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { usePlayers } from "~/composables/usePlayers";
import type { Player } from "~/types/player";
import { useRouter } from "vue-router";
import { useUserStore } from "~/stores/userStore";
import { useLobby } from "~/composables/useLobby";
import { useUserAccess } from "~/composables/useUserUtils";
import { useGetPlayerName } from "~/composables/useGetPlayerName";
import type { Lobby } from "~/types/lobby";
import { useI18n } from "vue-i18n";
const { t } = useI18n();

const { $activityFetch } = useNuxtApp();
const config = useRuntimeConfig();
const showJoin = ref(false);
const creatingLobby = ref(false);
const { getPlayerName, getPlayerNameSync, playerCache } = useGetPlayerName();

type LobbyWithName = Lobby & {
  lobbyName?: string | null;
  hostName?: string;
};
const lobbies = ref<LobbyWithName[]>([]);

const router = useRouter();
const userStore = useUserStore();
const { getActiveLobbyForUser, createLobby } = useLobby();
const { notify } = useNotifications();
const { showIfAuthenticated } = useUserAccess();
const { getPlayersForLobby } = usePlayers();
const hostNames = ref<Record<string, string>>({});
const lobbyPlayers = ref<Record<string, Player[]>>({});

// ─── Teleportal Live Data ─────────────────────────────────────────────────

interface LobbySummary {
  code: string;
  phase: string;
  round: number;
  players: number;
  playerNames: string[];
}

const liveLobbies = ref<Record<string, LobbySummary>>({});
let pollTimer: ReturnType<typeof setInterval> | null = null;
const POLL_INTERVAL_MS = 10_000;

/** Derive the HTTP base URL from the WS-based lobbyTeleportalUrl */
const teleportalHttpUrl = computed(() => {
  const wsUrl = config.public.lobbyTeleportalUrl || "ws://localhost:1235";
  return wsUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
});

/** Fetch lightweight lobby summaries from the Teleportal server */
const fetchLiveSummary = async () => {
  try {
    const res = await $fetch<{ lobbies: LobbySummary[]; timestamp: number }>(
      `${teleportalHttpUrl.value}/lobbies/summary`,
    );
    const map: Record<string, LobbySummary> = {};
    for (const lobby of res.lobbies) {
      map[lobby.code] = lobby;
    }
    liveLobbies.value = map;
  } catch {
    // Silently fail — live data is best-effort enhancement
  }
};

/** Look up live info for a lobby by code */
const getLiveInfo = (code: string): LobbySummary | null => {
  return liveLobbies.value[code] || null;
};

// ─── Status Badge (Right Side) ────────────────────────────────────────────

const getStatusLabel = (
  lobby: LobbyWithName,
  live: LobbySummary | null,
): string => {
  if (live) {
    if (live.phase === "waiting") return "Waiting";
    if (live.phase === "complete") return "Finished";
    return `Round ${live.round}`;
  }
  return lobby.status;
};

const getStatusBadgeClasses = (
  lobby: LobbyWithName,
  live: LobbySummary | null,
): string => {
  const phase = live?.phase || lobby.status;
  if (phase === "waiting")
    return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
  if (phase === "complete")
    return "bg-rose-500/10 border-rose-500/30 text-rose-400";
  // Any in-progress phase
  return "bg-amber-500/10 border-amber-500/30 text-amber-400";
};

const getStatusDotClass = (
  lobby: LobbyWithName,
  live: LobbySummary | null,
): string => {
  const phase = live?.phase || lobby.status;
  if (phase === "waiting") return "bg-emerald-400";
  if (phase === "complete") return "bg-rose-400";
  return "bg-amber-400";
};

// ─── Sorted Lobbies ───────────────────────────────────────────────────────
// Waiting lobbies first (people are waiting for players), then playing, then complete.

const sortedLobbies = computed(() => {
  return [...lobbies.value].sort((a, b) => {
    const liveA = getLiveInfo(a.code);
    const liveB = getLiveInfo(b.code);
    const phaseA = liveA?.phase || a.status;
    const phaseB = liveB?.phase || b.status;

    // Normalize to status bucket
    const orderA = phaseA === "waiting" ? 0 : phaseA === "complete" ? 2 : 1;
    const orderB = phaseB === "waiting" ? 0 : phaseB === "complete" ? 2 : 1;

    if (orderA !== orderB) return orderA - orderB;
    // Within same status, sort by player count descending (more active first)
    const playersA = liveA?.players ?? 0;
    const playersB = liveB?.players ?? 0;
    return playersB - playersA;
  });
});

// ─── Public Lobby Data Fetch ─────────────────────────────────────────────

const fetchPublicLobbies = async () => {
  try {
    const lobbyRows = await $activityFetch<Lobby[]>("/api/lobby/list");

    const publicLobbies: LobbyWithName[] = [];

    for (const lobby of lobbyRows) {
      // Start fetching the host name in the background
      if (lobby.hostUserId) {
        getPlayerName(lobby.hostUserId).then((name) => {
          hostNames.value[lobby.hostUserId] = name;
        });
      }

      // Fetch all players for this lobby in the background
      getPlayersForLobby(lobby.id).then((players) => {
        lobbyPlayers.value[lobby.id] = players;
      });

      publicLobbies.push({
        ...lobby,
        lobbyName: lobby.lobbyName || "Unnamed Lobby",
      });
    }

    lobbies.value = publicLobbies;
  } catch (err) {
    console.error("Failed to fetch public lobbies:", err);
  }
};

// Function to get host name for a specific lobby
const getHostName = (lobby: LobbyWithName): string => {
  if (!lobby.hostUserId) return "Unknown Host";

  // Use the synchronous version which will return from cache if available
  // or trigger a background fetch if not
  return getPlayerNameSync(lobby.hostUserId);
};

// Function to get host avatar for a specific lobby
const getHostAvatar = (lobby: LobbyWithName): string | null => {
  if (!lobby.hostUserId) return null;
  return playerCache.value[lobby.hostUserId]?.avatar ?? null;
};

onMounted(async () => {
  // Only fetch if session isn't already established
  if (!userStore.isLoggedIn) {
    await userStore.fetchSession();
  }

  // Fetch public lobbies and Teleportal live data in parallel
  await Promise.all([fetchPublicLobbies(), fetchLiveSummary()]);

  const userId = userStore.user?.id;
  if (userId) {
    const activeLobby = await getActiveLobbyForUser(userId);
    if (activeLobby?.code) {
      return router.replace(`/game/${activeLobby.code}`);
    }
  }

  // Start polling for live data
  pollTimer = setInterval(fetchLiveSummary, POLL_INTERVAL_MS);
});

onBeforeUnmount(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});

const handleCreateLobby = async () => {
  if (!userStore.user?.id) return;
  try {
    creatingLobby.value = true;
    const lobby = await createLobby(userStore.user.id);
    if (!lobby?.code) throw new Error("Invalid lobby response");
    router.replace(`/game/${lobby.code}`);
  } catch (error: unknown) {
    notify({
      title: t("modal.error_create_lobby"),
      description: error instanceof Error ? error.message : "Unknown error",
      color: "error",
    });
  } finally {
    creatingLobby.value = false;
  }
};

const handleJoined = (code: string) => {
  return router.replace(`/game/${code}`);
};
</script>

<style scoped>
/* ── Hero ─────────────────────────────────────────────────────── */
.lobby-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 1.5rem;
  padding-bottom: 2.5rem;
  text-align: center;
}

.lobby-title {
  font-family: "Bebas Neue", sans-serif;
  font-size: clamp(1.5rem, 5vw, 2.5rem);
  color: #e2e8f0;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
  text-transform: uppercase;
  drop-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}

/* ── Lobby grid ───────────────────────────────────────────────── */
.lobby-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.lobby-card {
  --lobby-accent: #f472b6;
  position: relative;
  display: flex;
  min-height: 276px;
  flex-direction: column;
  gap: 1.25rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  padding: 1.125rem;
  color: #f8fafc;
  cursor: pointer;
  background:
    repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.018) 0 8px, transparent 8px 18px),
    rgba(10, 13, 28, 0.82);
  box-shadow: 0 18px 35px -24px rgba(0, 0, 0, 0.95);
  transition: transform 180ms cubic-bezier(.2, .8, .2, 1), border-color 180ms, box-shadow 180ms;
}

.lobby-card--waiting { --lobby-accent: #a3e635; }
.lobby-card--complete { --lobby-accent: #fb7185; }

.lobby-card:hover {
  transform: translateY(-4px) rotate(-0.35deg);
  border-color: var(--lobby-accent);
  box-shadow: 0 24px 40px -22px rgba(0, 0, 0, 0.9), 0 0 0 1px var(--lobby-accent);
}

.lobby-card:focus-visible {
  outline: 2px solid var(--lobby-accent);
  outline-offset: 3px;
}

.lobby-card__accent {
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: var(--lobby-accent);
}

.lobby-card__topline,
.lobby-card__title-row,
.lobby-card__footer,
.lobby-card__meta,
.lobby-card__status {
  display: flex;
  align-items: center;
}

.lobby-card__topline { justify-content: space-between; gap: 0.75rem; }

.lobby-card__code {
  color: #71809e;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.lobby-card__status {
  gap: 0.35rem;
  border: 1px solid currentColor;
  border-radius: 999px;
  padding: 0.22rem 0.5rem;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
}

.lobby-card__status-dot { width: 0.35rem; height: 0.35rem; border-radius: 50%; }

.lobby-card__title-row { gap: 0.75rem; }

.lobby-card__host-avatar {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--lobby-accent) 48%, transparent);
  border-radius: 50%;
  color: var(--lobby-accent);
  background: color-mix(in srgb, var(--lobby-accent) 12%, #0d0f1a);
}

.lobby-card__avatar-image,
.lobby-card__seat img { width: 100%; height: 100%; object-fit: cover; }

.lobby-card__name {
  color: #f8fafc;
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.4rem;
  letter-spacing: 0.04em;
  line-height: 1;
  text-transform: uppercase;
}

.lobby-card__host {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.32rem;
  color: #8b96b3;
  font-size: 0.72rem;
}

.lobby-card__host > span { color: #fbbf24; }

.lobby-card__seats { display: flex; min-height: 1.85rem; gap: 0.35rem; align-items: center; }

.lobby-card__seat {
  display: inline-grid;
  width: 1.8rem;
  height: 1.8rem;
  place-items: center;
  overflow: hidden;
  border: 2px solid #111525;
  border-radius: 50%;
  color: #0b1020;
  background: var(--lobby-accent);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.62rem;
  font-weight: 800;
}

.lobby-card__seat--empty {
  border: 1px dashed rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.3);
  background: transparent;
}

.lobby-card__footer { margin-top: auto; gap: 0.85rem; }

.lobby-card__meta {
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.45rem;
  color: #8b96b3;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.lobby-card__meter {
  height: 0.35rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.09);
}

.lobby-card__meter > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: repeating-linear-gradient(-45deg, transparent 0 5px, rgba(255, 255, 255, 0.2) 5px 8px), var(--lobby-accent);
  transition: width 400ms ease;
}

.lobby-card__join { flex-shrink: 0; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }

@media (max-width: 640px) {
  .lobby-grid { grid-template-columns: 1fr; }
  .lobby-card { min-height: 250px; }
}

@media (prefers-reduced-motion: reduce) {
  .lobby-card, .lobby-card__meter > span { transition: none; }
  .lobby-card:hover { transform: none; }
}
</style>
