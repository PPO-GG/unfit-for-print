<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useNotifications } from "~/composables/useNotifications";
import { useLobbyMonitor } from "~/composables/useLobbyMonitor";
import { lobbyHealth } from "~/utils/lobbyHealth";
import { formatAgo, liveKpis, matchesSearch, sortLiveLobbies } from "~/utils/lobbyMonitorView";

const { notify } = useNotifications();
const { confirm } = useConfirm();
const { $activityFetch } = useNuxtApp();
const route = useRoute();
const router = useRouter();

// Typed as a plain fetcher: the monitor passes runtime URLs, and $activityFetch's
// route-keyed generics blow the type checker's stack depth on them.
const rawFetch = $activityFetch as unknown as <T>(
  url: string,
  opts?: Record<string, unknown>,
) => Promise<T>;

const monitor = useLobbyMonitor({
  fetch: rawFetch,
  confirm,
  notify,
});
const { status, activity, error, lastUpdated, autoRefresh } = monitor;

// One clock for every "ago" on the page.
const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | null = null;
let unmounted = false;

const search = ref("");
const housekeepingOpen = ref(false);

const lobbies = computed(() => status.value?.lobbies ?? []);
const issuesFor = (code: string) => status.value?.issues?.[code] ?? [];
const ttl = computed(() => status.value?.server.idleDocTtlSec ?? 600);

const kpis = computed(() => liveKpis(lobbies.value));
const live = computed(() => sortLiveLobbies(lobbies.value));
const shown = computed(() => live.value.filter((l) => matchesSearch(l, search.value)));
const attention = computed(() =>
  live.value
    .map((lobby) => ({ lobby, health: lobbyHealth(lobby, issuesFor(lobby.code), ttl.value) }))
    .filter((x): x is { lobby: typeof x.lobby; health: NonNullable<typeof x.health> } => !!x.health)
    .sort((a, b) => (a.health.level === b.health.level ? 0 : a.health.level === "red" ? -1 : 1)),
);

// The open lobby lives in the URL so issue pages can link straight to it.
const selectedCode = computed(() =>
  typeof route.query.lobby === "string" ? route.query.lobby.toUpperCase() : null,
);
const selected = computed(() => lobbies.value.find((l) => l.code === selectedCode.value) ?? null);
const drawerOpen = computed({
  // Wait for the first status payload, or a deep link flashes "no longer live".
  get: () => !!selectedCode.value && !!status.value,
  set: (value: boolean) => {
    if (!value) openLobby(null);
  },
});
function openLobby(code: string | null) {
  const query = { ...route.query };
  if (code) query.lobby = code;
  else delete query.lobby;
  router.replace({ query });
}

const updatedLabel = computed(() => {
  if (!autoRefresh.value) return "Paused";
  if (!lastUpdated.value) return "Loading…";
  return `Live · updated ${formatAgo((now.value - lastUpdated.value) / 1000)}`;
});

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    notify({ title: "Copied", description: code, color: "success" });
  } catch {
    notify({ title: "Couldn't copy", description: code, color: "error" });
  }
}

function endGameByCode(code: string) {
  const lobby = lobbies.value.find((l) => l.code === code);
  if (lobby) void monitor.endGame(lobby);
}

const onVisibility = () => monitor.onVisibilityChange(document.hidden);

onMounted(async () => {
  clock = setInterval(() => (now.value = Date.now()), 1000);
  document.addEventListener("visibilitychange", onVisibility);
  await monitor.refresh();
  if (!unmounted) monitor.start();
});

onUnmounted(() => {
  unmounted = true;
  monitor.stop();
  if (clock) clearInterval(clock);
  document.removeEventListener("visibilitychange", onVisibility);
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <span
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
        :class="error ? 'bg-red-500/15 text-red-300' : autoRefresh ? 'bg-lime-500/15 text-lime-300' : 'bg-slate-700 text-slate-300'"
      >
        ● {{ error ? "Couldn't refresh · retrying" : updatedLabel }}
      </span>
      <div class="flex flex-wrap gap-2">
        <UButton size="md" color="neutral" variant="soft" icon="i-solar-refresh-broken" loading-auto @click="monitor.manualRefresh()">
          Refresh
        </UButton>
        <UButton size="md" color="neutral" variant="soft" @click="monitor.toggleAutoRefresh()">
          {{ autoRefresh ? "Pause" : "Resume" }}
        </UButton>
        <UButton size="md" color="neutral" variant="soft" icon="i-solar-broom-bold-duotone" @click="housekeepingOpen = true">
          Housekeeping
          <span v-if="status?.housekeeping.leftoverCount" class="ml-1 rounded-full bg-amber-500 px-1.5 text-xs text-slate-950">
            {{ status.housekeeping.leftoverCount }}
          </span>
        </UButton>
      </div>
    </div>

    <p v-if="error" class="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
      {{ error }}<template v-if="status"> — showing data from {{ formatAgo((now - (lastUpdated ?? now)) / 1000) }}.</template>
    </p>

    <template v-if="status">
      <AdminLobbyKpis :kpis="kpis" :activity="activity" />
      <AdminLobbyAttention :items="attention" @inspect="openLobby" />

      <section>
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Live games · {{ live.length }}</h2>
          <UInput v-model="search" size="md" icon="i-solar-magnifer-broken" placeholder="Search code, name, host or player" class="w-full sm:w-80" />
        </div>
        <p v-if="shown.length === 0" class="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">
          {{ search ? "No live games match." : "No live games right now." }}
        </p>
        <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AdminLobbyCard v-for="lobby in shown" :key="lobby.code" :lobby="lobby" :now="now" @open="openLobby" />
        </div>
      </section>
    </template>
    <div v-else-if="!error" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <USkeleton v-for="i in 6" :key="i" class="h-40 rounded-xl" />
    </div>

    <AdminLobbyDrawer
      v-model:open="drawerOpen"
      :code="selectedCode"
      :lobby="selected"
      :issues="selectedCode ? issuesFor(selectedCode) : []"
      :health="selected ? lobbyHealth(selected, issuesFor(selected.code), ttl) : null"
      :now="now"
      @mark-finished="monitor.markFinished"
      @end-game="monitor.endGame"
      @remove-completely="monitor.removeCompletely"
      @delete-record="monitor.deleteRecord"
      @copy-code="copyCode"
    />
    <AdminHousekeepingDrawer
      v-model:open="housekeepingOpen"
      :housekeeping="status?.housekeeping ?? null"
      :server="status?.server ?? null"
      :live-games="live.length"
      :live-players="kpis.players"
      @prune-stale="monitor.pruneStale"
      @prune-all="monitor.pruneAllDbOnly"
      @end-all="monitor.endAllGames"
      @end-game="endGameByCode"
    />
  </div>
</template>
