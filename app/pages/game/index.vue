<template>
  <div class="games-browser lobby-tokens flex flex-col items-center justify-start text-white">
    <!-- ── Hero Section ─────────────────────────────────────────── -->
    <section class="games-hero z-10 w-full">
      <div class="games-hero__lede">


        <h1 class="games-hero__title">
          {{ t("games.hero_find_a") }}
          <span class="games-hero__accent">{{ t("games.hero_table") }}</span>,
          {{ t("games.hero_make_new") }}
          <span class="games-hero__yellow">{{ t("games.hero_friends") }}</span>
        </h1>

        <!-- <p class="games-hero__sub">{{ t("games.hero_subtitle") }}</p> -->

        <!-- Primary CTAs -->
        <div class="games-hero__cta">
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

      <!-- Live stats -->
      <div class="games-hero__stats">
        <div class="stat-tile" style="--tile-accent: var(--lb-accent-lime)">
          <div class="stat-tile__v">{{ stats.players }}</div>
          <div class="stat-tile__sub">{{ t("games.stat_players") }}</div>
          <svg
            v-if="sparkPath"
            class="stat-tile__spark"
            viewBox="0 0 200 28"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path :d="sparkArea" fill="var(--lb-accent-lime)" opacity="0.18" />
            <path
              :d="sparkPath"
              fill="none"
              stroke="var(--lb-accent-lime)"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>

        <div class="stat-tile" style="--tile-accent: var(--lb-accent-pink)">
          <div class="stat-tile__v">{{ stats.open }}</div>
          <div class="stat-tile__sub">{{ t("games.stat_open") }}</div>
        </div>

        <div class="stat-tile" style="--tile-accent: var(--lb-accent)">
          <div class="stat-tile__v">{{ stats.inGame }}</div>
          <div class="stat-tile__sub">{{ t("games.stat_in_game") }}</div>
        </div>

        <div class="stat-tile" style="--tile-accent: var(--lb-accent-yellow)">
          <div class="stat-tile__v">{{ stats.rounds }}</div>
          <div class="stat-tile__sub">{{ t("games.stat_rounds") }}</div>
        </div>
      </div>
    </section>

    <!-- ── Lobby Browser ─────────────────────────────────────────── -->
    <div class="w-full max-w-6xl px-4 pb-20 z-10">
      <!-- Count + sort -->
      <div class="games-toolbar">
        <div class="games-toolbar__count">
          <span class="games-toolbar__num">{{ sortedLobbies.length }}</span>
          <span class="games-toolbar__word">{{ t("games.tables") }}</span>
        </div>

        <div class="segmented" role="group" :aria-label="t('games.sort_label')">
          <button
            v-for="option in sortOptions"
            :key="option.value"
            type="button"
            class="segmented__btn"
            :class="{ 'segmented__btn--on': sortMode === option.value }"
            :aria-pressed="sortMode === option.value"
            @click="sortMode = option.value"
          >
            {{ t(option.label) }}
          </button>
        </div>
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
            <span class="lobby-card__code">
              {{ lobby.code }}
              <span class="lobby-card__age">· {{ relativeAge(lobby.createdAt) }}</span>
            </span>
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
                v-for="name in getLiveInfo(lobby.code)!.playerNames.slice(0, TABLE_SEATS)"
                :key="name"
                class="lobby-card__seat"
                :title="name"
              >{{ name.charAt(0) || "?" }}</span>
              <span
                v-for="seat in emptySeats(lobby)"
                :key="`empty-live-${seat}`"
                class="lobby-card__seat lobby-card__seat--empty"
              >+</span>
            </template>
            <template v-else>
              <span
                v-for="player in (lobbyPlayers[lobby.id] || []).slice(0, TABLE_SEATS)"
                :key="player.$id"
                class="lobby-card__seat overflow-hidden"
                :title="player.name"
              >
                <img v-if="player.avatar" :src="player.avatar" :alt="player.name" />
                <template v-else>{{ player.name?.charAt(0) || "?" }}</template>
              </span>
              <span
                v-for="seat in emptySeats(lobby)"
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
                  {{ getPlayerCount(lobby) }} {{ t("games.players") }}
                </span>
                <span v-if="getLiveInfo(lobby.code)?.round" class="tabular-nums">
                  Round {{ getLiveInfo(lobby.code)!.round }}
                </span>
              </div>
              <div class="lobby-card__meter" aria-hidden="true">
                <span :style="{ width: `${fillPct(lobby)}%` }" />
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
  } finally {
    now.value = Date.now();
    playerHistory.value = [...playerHistory.value, stats.value.players].slice(
      -SPARK_POINTS,
    );
  }
};

/** Look up live info for a lobby by code */
const getLiveInfo = (code: string): LobbySummary | null => {
  return liveLobbies.value[code] || null;
};

// ─── Seats ────────────────────────────────────────────────────────────────
// A lobby has no hard player limit, but the game table renders six seats
// (see GameTableSeats), so six is what the card meter and the sorts measure
// a table's fullness against.
const TABLE_SEATS = 6;

/** Live phase if Teleportal knows about the lobby, registry status otherwise */
const getPhase = (lobby: LobbyWithName): string =>
  getLiveInfo(lobby.code)?.phase || lobby.status;

/** Live player count if available, otherwise the registry player rows */
const getPlayerCount = (lobby: LobbyWithName): number =>
  getLiveInfo(lobby.code)?.players ?? lobbyPlayers.value[lobby.id]?.length ?? 0;

const emptySeats = (lobby: LobbyWithName): number =>
  Math.max(0, TABLE_SEATS - Math.min(getPlayerCount(lobby), TABLE_SEATS));

const fillPct = (lobby: LobbyWithName): number =>
  Math.min(100, (getPlayerCount(lobby) / TABLE_SEATS) * 100);

const createdMs = (lobby: LobbyWithName): number =>
  new Date(lobby.createdAt).getTime() || 0;

// ─── Hero Stats ───────────────────────────────────────────────────────────

const stats = computed(() => {
  let players = 0;
  let open = 0;
  let inGame = 0;
  let rounds = 0;

  for (const lobby of lobbies.value) {
    const phase = getPhase(lobby);
    const count = getPlayerCount(lobby);
    players += count;

    if (phase === "waiting") {
      open += 1;
    } else if (phase !== "complete") {
      inGame += count;
      rounds += getLiveInfo(lobby.code)?.round ?? 0;
    }
  }

  return { players, open, inGame, rounds };
});

// Rolling sample of the seated-player count, one point per poll. Starts empty
// and fills in as the page sits open — no line is drawn until it has shape.
const SPARK_POINTS = 18;
const SPARK_W = 200;
const SPARK_H = 28;
const playerHistory = ref<number[]>([]);

const sparkPath = computed(() => {
  const data = playerHistory.value;
  if (data.length < 3) return undefined;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;

  return data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * SPARK_W;
      const y = SPARK_H - ((value - min) / span) * (SPARK_H - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
});

const sparkArea = computed(() =>
  sparkPath.value
    ? `${sparkPath.value} L${SPARK_W},${SPARK_H} L0,${SPARK_H} Z`
    : undefined,
);

// ─── Relative Age ─────────────────────────────────────────────────────────

const now = ref(Date.now());

const relativeAge = (createdAt: string): string => {
  const ms = now.value - new Date(createdAt).getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return t("games.just_now");

  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return t("games.minutes_ago", { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("games.hours_ago", { count: hours });

  return t("games.days_ago", { count: Math.floor(hours / 24) });
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

// ─── Sorting ──────────────────────────────────────────────────────────────

type SortMode = "new" | "filling" | "seats";

const sortOptions: ReadonlyArray<{ value: SortMode; label: string }> = [
  { value: "new", label: "games.sort_new" },
  { value: "filling", label: "games.sort_filling" },
  { value: "seats", label: "games.sort_seats" },
];

const sortMode = ref<SortMode>("filling");

const sortedLobbies = computed(() => {
  return [...lobbies.value].sort((a, b) => {
    // Finished tables sink to the bottom whichever sort is active — nobody is
    // browsing for a game that is already over.
    const doneA = getPhase(a) === "complete" ? 1 : 0;
    const doneB = getPhase(b) === "complete" ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;

    if (sortMode.value === "new") return createdMs(b) - createdMs(a);

    if (sortMode.value === "seats") {
      // Emptiest tables first — the ones with the most room to join.
      const bySeats = emptySeats(b) - emptySeats(a);
      if (bySeats !== 0) return bySeats;
      return createdMs(b) - createdMs(a);
    }

    // "filling" — fullest tables first, so the ones about to start float up.
    const byFill = fillPct(b) - fillPct(a);
    if (byFill !== 0) return byFill;
    return createdMs(b) - createdMs(a);
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
/* ── Page tokens ──────────────────────────────────────────────── */
/* Pink is the browser's signature accent; the lobby room itself runs cyan. */
.games-browser {
  --lb-accent: oklch(72% 0.22 355);
  --lb-accent-shadow: oklch(55% 0.22 355);
  /* The app default is Bebas Neue, which has no lowercase glyphs. */
  font-family: "Barlow Condensed", system-ui, sans-serif;
}

/* ── Hero ─────────────────────────────────────────────────────── */
.games-hero {
  display: grid;
  gap: 2rem;
  align-items: end;
  width: 100%;
  max-width: 72rem;
  margin-inline: auto;
  /* Clears the layout's fixed back button. */
  padding: 5.5rem 1rem 2.5rem;
}

@media (min-width: 900px) {
  .games-hero {
    grid-template-columns: minmax(0, 1fr) 25rem;
    padding-top: 4rem;
  }
}

/* Right padding reserves room for the LIVE stamp's overhang. */
.games-hero__lede { padding-right: 2.5rem; }

.games-hero__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
}

.games-hero__kicker {
  display: inline-block;
  padding: 4px 10px 3px;
  color: #0d0f1a;
  background: var(--lb-accent);
  font-family: "Archivo Black", sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transform: rotate(-1.5deg);
}

.games-hero__title {
  margin-top: 0.9rem;
  color: var(--lb-ink);
  font-family: "Archivo Black", "Bebas Neue", sans-serif;
  font-size: clamp(2rem, 6vw, 4.5rem);
  letter-spacing: -0.01em;
  line-height: 0.86;
  text-transform: uppercase;
}

.games-hero__accent { color: var(--lb-accent); }
.games-hero__yellow { color: var(--lb-accent-yellow); }
.games-hero__tilt { display: inline-block; transform: rotate(-1deg); }
.games-hero__stamped { position: relative; display: inline-block; }

@keyframes games-stamp-wobble {
  0%, 100% { transform: rotate(-6deg) scale(1); }
  50%      { transform: rotate(-4deg) scale(1.02); }
}

.games-hero__sub {
  max-width: 34rem;
  margin-top: 1rem;
  color: var(--lb-ink-dim);
  font-size: 1.15rem;
  line-height: 1.35;
}

.games-hero__cta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

/* ── Stat tiles ───────────────────────────────────────────────── */
.games-hero__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.stat-tile {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--lb-line-strong);
  border-radius: 12px;
  padding: 1rem 1.1rem;
  background: rgba(10, 13, 28, 0.72);
  backdrop-filter: blur(10px);
}

.stat-tile::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 2px;
  background: var(--tile-accent, var(--lb-accent));
  opacity: 0.7;
}

.stat-tile__v {
  color: var(--lb-ink);
  font-family: "Archivo Black", sans-serif;
  font-size: 1.85rem;
  font-variant-numeric: tabular-nums;
  line-height: 0.95;
}

.stat-tile__sub {
  margin-top: 0.42rem;
  color: var(--lb-ink-muted);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.56rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.stat-tile__spark {
  display: block;
  width: 100%;
  height: 28px;
  margin-top: 0.5rem;
}

/* ── Count + sort toolbar ─────────────────────────────────────── */
.games-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-inline: 0.25rem;
}

.games-toolbar__count { display: flex; align-items: center; gap: 0.6rem; }

.games-toolbar__num,
.games-toolbar__word {
  font-family: "Archivo Black", sans-serif;
  font-size: 1.35rem;
  line-height: 1;
  text-transform: uppercase;
}

.games-toolbar__num { color: var(--lb-ink); font-variant-numeric: tabular-nums; }
.games-toolbar__word { color: var(--lb-accent); }

.segmented {
  display: inline-flex;
  border: 1px solid var(--lb-line-strong);
  border-radius: 8px;
  padding: 3px;
  background: rgba(255, 255, 255, 0.04);
}

.segmented__btn {
  border-radius: 6px;
  padding: 6px 12px;
  color: var(--lb-ink-dim);
  font-family: "Archivo Black", sans-serif;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
  transition: color 150ms, background 150ms;
}

.segmented__btn:hover { color: var(--lb-ink); }
.segmented__btn--on { color: #0d0f1a; background: var(--lb-accent); }
.segmented__btn:focus-visible { outline: 2px solid var(--lb-accent); outline-offset: 2px; }

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

.lobby-card__age {
  color: #565d7e;
  font-weight: 500;
  letter-spacing: 0.08em;
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
  .games-hero__stamp { animation: none; transform: rotate(-6deg); }
}
</style>
