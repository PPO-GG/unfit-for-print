<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import type { TableColumn } from "@nuxt/ui";
import { getPaginationRowModel, type SortingState } from "@tanstack/vue-table";
import { useNotifications } from "~/composables/useNotifications";
import type { UnifiedLobby } from "~~/server/utils/mergeLobbies";
import type { UnifiedStatusResponse } from "~~/server/api/admin/teleportal/status.get";

const { notify } = useNotifications();
const { confirm } = useConfirm();
const { $activityFetch } = useNuxtApp();

// ── State ─────────────────────────────────────────────────────────────────
const status = ref<UnifiedStatusResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const searchTerm = ref("");
const sourceFilter = ref<"all" | "live" | "orphaned">("all");
const autoRefreshEnabled = ref(true);

const pagination = ref({ pageIndex: 0, pageSize: 10 });
const sorting = ref<SortingState>([]);

const setPage = (page: number) => {
  pagination.value = { ...pagination.value, pageIndex: page - 1 };
};

watch([searchTerm, sourceFilter], () => {
  pagination.value.pageIndex = 0;
});

const REFRESH_INTERVAL = 10_000;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

// ── Computed ──────────────────────────────────────────────────────────────
const filteredLobbies = computed(() => {
  if (!status.value) return [];
  let list = status.value.lobbies;

  // Source filter
  if (sourceFilter.value === "live") {
    list = list.filter((l) => l.hasLiveDoc);
  } else if (sourceFilter.value === "orphaned") {
    list = list.filter((l) => !l.hasLiveDoc || !l.hasRegistry);
  }

  // Search
  if (searchTerm.value) {
    const term = searchTerm.value.toLowerCase();
    list = list.filter(
      (l) =>
        l.code.toLowerCase().includes(term) ||
        l.registry?.lobbyName?.toLowerCase().includes(term) ||
        l.teleportal?.meta?.lobbyName?.toLowerCase().includes(term),
    );
  }

  return list;
});

const orphanedLobbiesCount = computed(() => {
  if (!status.value) return 0;
  return status.value.lobbies.filter(
    (l) => !l.hasLiveDoc && l.hasRegistry && l.registry?.status !== "complete",
  ).length;
});

const columns: TableColumn<UnifiedLobby>[] = [
  { accessorKey: "code", header: "Lobby", enableSorting: true },
  { id: "status", header: "Status", enableSorting: false },
  { id: "players", header: "Players", enableSorting: false },
  { id: "activity", header: "Activity", enableSorting: false },
  {
    id: "createdAt",
    accessorFn: (row) => row.registry?.createdAt || "",
    header: "Created",
    enableSorting: true,
  },
  { id: "actions", header: "", enableSorting: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────
function formatUptime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function lobbyName(lobby: UnifiedLobby): string {
  return (
    lobby.registry?.lobbyName ||
    lobby.teleportal?.meta?.lobbyName ||
    lobby.code
  );
}

// ── Fetch ─────────────────────────────────────────────────────────────────
const fetchStatus = async () => {
  loading.value = true;
  error.value = null;
  try {
    status.value = await $activityFetch<UnifiedStatusResponse>(
      "/api/admin/teleportal/status",
    );
  } catch (err: any) {
    console.error("[LobbyMonitor] Fetch failed:", err);
    error.value = err?.message || "Failed to fetch lobby data";
  } finally {
    loading.value = false;
  }
};

// ── Actions ───────────────────────────────────────────────────────────────
const gcLobby = async (lobby: UnifiedLobby) => {
  if (!lobby.teleportal) return;
  const confirmed = await confirm({
    title: "Force-Remove Lobby",
    message: `Force-remove lobby "${lobbyName(lobby)}"?\n\nThis will disconnect all players and destroy the game state immediately.`,
    confirmButtonText: "Remove",
    confirmButtonColor: "error",
  });
  if (!confirmed) return;
  try {
    await $activityFetch("/api/admin/teleportal/gc", {
      method: "DELETE",
      body: { docId: lobby.teleportal.docId },
    });
    notify({ title: "Lobby Removed", description: `${lobby.code} GC'd from Teleportal`, color: "success" });
    await fetchStatus();
  } catch (err: any) {
    const msg = err?.data?.statusMessage || err?.data?.message || err?.message || "Could not remove lobby";
    console.error("[LobbyMonitor] GC failed:", msg, err);
    notify({ title: "GC Failed", description: msg, color: "error" });
  }
};

const deleteLobby = async (lobby: UnifiedLobby) => {
  if (!lobby.registry) return;
  const confirmed = await confirm({
    title: "Delete Registry Entry",
    message: `Delete database records for "${lobbyName(lobby)}"?\n\nThis cascade-deletes players, chat, settings, and the lobby document. Cannot be undone.`,
    confirmButtonText: "Delete",
    confirmButtonColor: "error",
  });
  if (!confirmed) return;
  try {
    await $activityFetch("/api/admin/lobby/delete", {
      method: "POST",
      body: { lobbyId: lobby.registry.lobbyId },
    });
    notify({ title: "Registry Deleted", description: `${lobby.code} removed from database`, color: "success" });
    await fetchStatus();
  } catch (err: any) {
    const msg = err?.data?.statusMessage || err?.data?.message || err?.message || "Could not delete lobby";
    console.error("[LobbyMonitor] Delete failed:", msg, err);
    notify({ title: "Delete Failed", description: msg, color: "error" });
  }
};

const markComplete = async (lobby: UnifiedLobby) => {
  if (!lobby.registry) return;
  try {
    await $activityFetch("/api/admin/lobby/update-status", {
      method: "POST",
      body: { lobbyId: lobby.registry.lobbyId, status: "complete" },
    });
    notify({ title: "Marked Complete", description: `${lobby.code} status set to complete`, color: "success" });
    await fetchStatus();
  } catch (err: any) {
    const msg = err?.data?.statusMessage || err?.data?.message || err?.message || "Could not update status";
    console.error("[LobbyMonitor] Mark complete failed:", msg, err);
    notify({ title: "Update Failed", description: msg, color: "error" });
  }
};

const fullCleanup = async (lobby: UnifiedLobby) => {
  if (!lobby.teleportal || !lobby.registry) return;
  const confirmed = await confirm({
    title: "Full Cleanup",
    message: `Full cleanup for "${lobbyName(lobby)}"?\n\nThis will GC the live Teleportal doc AND delete all database records. Cannot be undone.`,
    confirmButtonText: "Full Cleanup",
    confirmButtonColor: "error",
  });
  if (!confirmed) return;
  let gcDone = false;
  try {
    await $activityFetch("/api/admin/teleportal/gc", {
      method: "DELETE",
      body: { docId: lobby.teleportal.docId },
    });
    gcDone = true;
    await $activityFetch("/api/admin/lobby/delete", {
      method: "POST",
      body: { lobbyId: lobby.registry.lobbyId },
    });
    notify({ title: "Full Cleanup Done", description: `${lobby.code} removed from both systems`, color: "success" });
    await fetchStatus();
  } catch (err: any) {
    const msg = err?.data?.statusMessage || err?.data?.message || err?.message || "Check lobby state manually";
    console.error("[LobbyMonitor] Full cleanup failed:", msg, err);
    notify({
      title: gcDone ? "Registry Delete Failed (GC succeeded)" : "GC Failed",
      description: msg,
      color: "error",
    });
    await fetchStatus();
  }
};

const gcAll = async () => {
  const confirmed = await confirm({
    title: "Force GC All Lobbies",
    message: "Force GC ALL live lobbies?\n\nThis will disconnect ALL players from ALL live games immediately.",
    confirmButtonText: "Force GC All",
    confirmButtonColor: "error",
  });
  if (!confirmed) return;
  try {
    const result = await $activityFetch<{ flushed: number; remaining: number }>(
      "/api/admin/teleportal/gc-all",
      { method: "DELETE" },
    );
    notify({
      title: "All Lobbies Flushed",
      description: `${result.flushed} lobby(s) removed, ${result.remaining} client(s) remain`,
      color: "success",
    });
    await fetchStatus();
  } catch (err: any) {
    const msg = err?.data?.statusMessage || err?.data?.message || err?.message || "Could not flush lobbies";
    console.error("[LobbyMonitor] GC all failed:", msg, err);
    notify({ title: "GC Failed", description: msg, color: "error" });
  }
};

const pruneStale = async (forceAll = false) => {
  const confirmed = await confirm({
    title: forceAll ? "Force Prune All Orphans" : "Prune Stale Lobbies",
    message: forceAll
      ? "Force prune ALL orphaned database lobbies regardless of age?\n\nLive Teleportal games will remain intact."
      : "Prune stale lobbies from database?\n\n- Orphaned lobbies (>2h without live players)\n- Completed lobbies (>1h old)",
    confirmButtonText: "Prune",
    confirmButtonColor: "warning",
  });
  if (!confirmed) return;

  try {
    const result = await $activityFetch<{
      prunedCount: number;
      orphanedCount: number;
      completedCount: number;
    }>("/api/admin/lobby/prune", {
      method: "POST",
      body: { forceAllOrphans: forceAll },
    });
    notify({
      title: "Prune Complete",
      description: `Removed ${result.prunedCount} lobby(s) (${result.orphanedCount} orphaned, ${result.completedCount} completed)`,
      color: "success",
    });
    await fetchStatus();
  } catch (err: any) {
    const msg = err?.data?.statusMessage || err?.data?.message || err?.message || "Could not prune lobbies";
    console.error("[LobbyMonitor] Prune failed:", msg, err);
    notify({ title: "Prune Failed", description: msg, color: "error" });
  }
};

// ── Auto-Refresh ──────────────────────────────────────────────────────────
function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(fetchStatus, REFRESH_INTERVAL);
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function toggleAutoRefresh() {
  autoRefreshEnabled.value = !autoRefreshEnabled.value;
  if (autoRefreshEnabled.value) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
}

const manualRefresh = async () => {
  await fetchStatus();
  // Reset interval so we don't double-trigger right after manual refresh
  if (autoRefreshEnabled.value) startAutoRefresh();
};

// Pause auto-refresh when tab is hidden
function handleVisibilityChange() {
  if (document.hidden) {
    stopAutoRefresh();
  } else if (autoRefreshEnabled.value) {
    fetchStatus();
    startAutoRefresh();
  }
}

onMounted(async () => {
  await fetchStatus();
  if (autoRefreshEnabled.value) startAutoRefresh();
  document.addEventListener("visibilitychange", handleVisibilityChange);
});

onUnmounted(() => {
  stopAutoRefresh();
  document.removeEventListener("visibilitychange", handleVisibilityChange);
});
</script>

<template>
  <div class="space-y-4">
    <!-- ═══ HEADER BAR ═══════════════════════════════════════════════════ -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <h3 class="text-lg font-semibold text-white">Unified Lobby Monitor</h3>
        <UBadge v-if="status?.server" color="success" variant="subtle" size="xs">
          v{{ status.server.version }}
        </UBadge>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <!-- Server stats -->
        <template v-if="status?.server">
          <UBadge color="neutral" variant="subtle" size="md">
            {{ status.server.activeClients }} client(s)
          </UBadge>
          <UBadge color="neutral" variant="subtle" size="md">
            Up {{ formatUptime(status.server.uptime) }}
          </UBadge>
          <UBadge color="neutral" variant="subtle" size="md">
            {{ status.server.memoryUsage.rss }}
          </UBadge>
        </template>

        <UButton
          color="error"
          variant="soft"
          size="xs"
          icon="i-solar-trash-bin-minimalistic-bold-duotone"
          @click="gcAll"
          :disabled="!status?.lobbies.some((l) => l.hasLiveDoc)"
          :tooltip="{ text: 'Force GC all live lobbies' }"
        >
          GC All
        </UButton>

        <UButton
          color="warning"
          variant="soft"
          size="xs"
          icon="i-solar-broom-bold-duotone"
          @click="pruneStale(false)"
          :tooltip="{ text: 'Prune stale lobbies (>2h orphaned, >1h complete)' }"
        >
          Prune Stale
        </UButton>

        <UButton
          v-if="orphanedLobbiesCount > 0"
          color="warning"
          variant="outline"
          size="xs"
          icon="i-solar-trash-bin-trash-bold-duotone"
          @click="pruneStale(true)"
          :tooltip="{ text: `Force prune all ${orphanedLobbiesCount} orphaned database record(s)` }"
        >
          Prune Orphans ({{ orphanedLobbiesCount }})
        </UButton>

        <UButton
          :color="autoRefreshEnabled ? 'success' : 'neutral'"
          variant="soft"
          size="xs"
          @click="toggleAutoRefresh"
          :tooltip="{ text: autoRefreshEnabled ? 'Auto-refresh ON (10s)' : 'Auto-refresh OFF' }"
        >
          Auto {{ autoRefreshEnabled ? "●" : "○" }}
        </UButton>

        <UButton
          loading-auto
          @click="manualRefresh"
          color="secondary"
          variant="soft"
          size="xs"
          icon="i-solar-refresh-broken"
        >
          Refresh
        </UButton>
      </div>
    </div>

    <!-- ═══ SEARCH & FILTER ══════════════════════════════════════════════ -->
    <div class="flex flex-col sm:flex-row gap-3">
      <UInput
        v-model="searchTerm"
        placeholder="Search by code or name..."
        class="flex-1"
        icon="i-solar-magnifer-broken"
      />
      <USelectMenu
        :items="[
          { label: 'All', value: 'all' },
          { label: 'Live', value: 'live' },
          { label: 'Orphaned / Ghost', value: 'orphaned' },
        ]"
        v-model="sourceFilter"
        value-key="value"
        class="w-48"
      />
    </div>

    <!-- ═══ ERROR STATE ══════════════════════════════════════════════════ -->
    <div
      v-if="error"
      class="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-center"
    >
      <UIcon
        name="i-solar-shield-warning-bold-duotone"
        class="h-8 w-8 mx-auto text-red-400 mb-2"
      />
      <p class="text-red-300 text-sm">{{ error }}</p>
    </div>

    <!-- ═══ LOADING STATE ════════════════════════════════════════════════ -->
    <div v-else-if="loading && !status" class="space-y-3">
      <div
        v-for="i in 3"
        :key="i"
        class="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50"
      >
        <div class="flex justify-between items-center">
          <USkeleton class="h-5 w-40" />
          <USkeleton class="h-6 w-20" />
        </div>
        <div class="flex gap-2 mt-3">
          <USkeleton class="h-6 w-24" />
          <USkeleton class="h-6 w-24" />
        </div>
      </div>
    </div>

    <!-- ═══ EMPTY STATE ══════════════════════════════════════════════════ -->
    <div
      v-else-if="filteredLobbies.length === 0"
      class="bg-slate-800/30 border border-slate-700/30 rounded-lg p-6 text-center"
    >
      <UIcon
        name="i-solar-server-minimalistic-line-duotone"
        class="h-10 w-10 mx-auto text-gray-500 mb-2"
      />
      <p class="text-gray-400 text-sm">
        {{ searchTerm || sourceFilter !== 'all' ? 'No lobbies match your filters.' : 'No lobbies found.' }}
      </p>
    </div>

    <!-- ═══ LOBBY TABLE ═══════════════════════════════════════════════════ -->
    <div v-else class="space-y-3">
      <div class="rounded-lg border border-slate-700/60 overflow-hidden bg-slate-800/40">
        <UTable
          v-model:pagination="pagination"
          v-model:sorting="sorting"
          :data="filteredLobbies"
          :columns="columns"
          :loading="loading"
          :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
          class="text-white"
        >
          <!-- Lobby Code & Name Header -->
          <template #code-header="{ column }">
            <UButton
              color="neutral"
              variant="ghost"
              label="Lobby"
              :icon="
                column.getIsSorted()
                  ? column.getIsSorted() === 'asc'
                    ? 'i-lucide-arrow-up-narrow-wide'
                    : 'i-lucide-arrow-down-wide-narrow'
                  : 'i-lucide-arrow-up-down'
              "
              class="-mx-2.5 font-semibold text-slate-300"
              @click="column.toggleSorting(column.getIsSorted() === 'asc')"
            />
          </template>

          <!-- Created Header -->
          <template #createdAt-header="{ column }">
            <UButton
              color="neutral"
              variant="ghost"
              label="Created"
              :icon="
                column.getIsSorted()
                  ? column.getIsSorted() === 'asc'
                    ? 'i-lucide-arrow-up-narrow-wide'
                    : 'i-lucide-arrow-down-wide-narrow'
                  : 'i-lucide-arrow-up-down'
              "
              class="-mx-2.5 font-semibold text-slate-300"
              @click="column.toggleSorting(column.getIsSorted() === 'asc')"
            />
          </template>

          <!-- Lobby Code & Subtitle Cell -->
          <template #code-cell="{ row }">
            <div class="py-1">
              <div class="flex items-center gap-1.5">
                <span class="font-mono font-bold text-white text-base tracking-wide">{{ row.original.code }}</span>
                <UBadge
                  v-if="row.original.hasLiveDoc && row.original.hasRegistry"
                  color="success"
                  variant="subtle"
                  size="xs"
                >
                  ● live
                </UBadge>
              </div>
              <p class="text-xs text-slate-400 truncate max-w-[220px]" :title="lobbyName(row.original)">
                {{ lobbyName(row.original) }}
                <span v-if="row.original.teleportal?.meta?.hostName" class="text-slate-500">
                  · Host: {{ row.original.teleportal.meta.hostName }}
                </span>
              </p>
            </div>
          </template>

          <!-- Status & Phase Cell -->
          <template #status-cell="{ row }">
            <div class="flex flex-wrap items-center gap-1.5 py-1">
              <!-- Teleportal Phase (live only) -->
              <UBadge
                v-if="row.original.teleportal?.phase"
                :color="
                  row.original.teleportal.phase === 'lobby'
                    ? 'info'
                    : ['playing', 'judging', 'submission'].includes(row.original.teleportal.phase)
                      ? 'warning'
                      : ['roundEnd', 'gameOver'].includes(row.original.teleportal.phase)
                        ? 'success'
                        : 'neutral'
                "
                size="xs"
              >
                {{ row.original.teleportal.phase }}
              </UBadge>

              <!-- Registry Status -->
              <UBadge
                v-if="row.original.registry"
                :color="
                  row.original.registry.status === 'complete'
                    ? 'success'
                    : row.original.registry.status === 'playing'
                      ? 'warning'
                      : 'info'
                "
                size="xs"
              >
                {{ row.original.registry.status }}
              </UBadge>

              <!-- Warnings -->
              <UBadge
                v-if="!row.original.hasLiveDoc && row.original.hasRegistry && row.original.registry?.status !== 'complete'"
                color="warning"
                size="xs"
              >
                ⚠ orphaned
              </UBadge>
              <UBadge
                v-if="row.original.hasLiveDoc && !row.original.hasRegistry"
                color="error"
                size="xs"
              >
                ⚠ no registry
              </UBadge>
            </div>
          </template>

          <!-- Players Cell -->
          <template #players-cell="{ row }">
            <div class="py-1">
              <template v-if="row.original.teleportal">
                <span
                  v-if="!row.original.teleportal.players?.length"
                  class="text-xs text-slate-500 italic"
                >
                  0 players
                </span>
                <div v-else class="flex items-center gap-1.5 flex-wrap max-w-xs">
                  <UBadge color="neutral" variant="subtle" size="xs">
                    {{ row.original.teleportal.players.length }}
                  </UBadge>
                  <div
                    v-for="player in row.original.teleportal.players.slice(0, 3)"
                    :key="player.id"
                    class="text-xs text-white bg-slate-700/60 border border-slate-600/40 px-1.5 py-0.5 rounded flex items-center gap-1"
                    :title="player.name + (player.isBot ? ' (Bot)' : '')"
                  >
                    <img
                      v-if="player.avatar"
                      :src="player.avatar"
                      :alt="player.name"
                      class="w-3.5 h-3.5 rounded-full"
                    />
                    <span class="max-w-[70px] truncate">{{ player.name }}</span>
                    <span v-if="player.isBot" class="text-[10px] text-amber-400 font-mono">B</span>
                  </div>
                  <span
                    v-if="row.original.teleportal.players.length > 3"
                    class="text-[11px] text-slate-400"
                    :title="row.original.teleportal.players.slice(3).map((p: any) => p.name).join(', ')"
                  >
                    +{{ row.original.teleportal.players.length - 3 }}
                  </span>
                </div>
              </template>
              <span v-else class="text-xs text-slate-500 italic">—</span>
            </div>
          </template>

          <!-- Activity Cell -->
          <template #activity-cell="{ row }">
            <div class="flex flex-wrap items-center gap-1.5 py-1">
              <template v-if="row.original.teleportal">
                <UBadge color="primary" variant="subtle" size="xs">
                  {{ row.original.teleportal.clients }} ws
                </UBadge>
                <UBadge
                  v-if="row.original.teleportal.round"
                  color="info"
                  variant="subtle"
                  size="xs"
                >
                  R{{ row.original.teleportal.round }}
                </UBadge>
                <UBadge
                  v-if="row.original.teleportal.idleSec > 30"
                  color="warning"
                  variant="subtle"
                  size="xs"
                >
                  idle {{ row.original.teleportal.idleSec }}s
                </UBadge>
              </template>
              <span v-else class="text-xs text-slate-500 italic">—</span>
            </div>
          </template>

          <!-- Created Cell -->
          <template #createdAt-cell="{ row }">
            <div class="text-xs text-slate-300 py-1">
              <span v-if="row.original.registry?.createdAt">
                {{ new Date(row.original.registry.createdAt).toLocaleString() }}
              </span>
              <span v-else class="text-slate-500 italic">—</span>
            </div>
          </template>

          <!-- Actions Cell -->
          <template #actions-cell="{ row }">
            <div class="flex items-center justify-end gap-1 py-1">
              <!-- Mark Complete -->
              <UButton
                v-if="row.original.registry && row.original.registry.status !== 'complete'"
                color="warning"
                variant="ghost"
                icon="i-solar-check-circle-bold-duotone"
                size="xs"
                @click="markComplete(row.original)"
                class="rounded-full"
                :tooltip="{ text: 'Mark as completed' }"
              />
              <!-- GC Teleportal doc -->
              <UButton
                v-if="row.original.hasLiveDoc"
                color="error"
                variant="ghost"
                icon="i-solar-trash-bin-trash-bold-duotone"
                size="xs"
                @click="gcLobby(row.original)"
                class="rounded-full"
                :tooltip="{ text: 'GC Teleportal doc' }"
              />
              <!-- Delete database registry -->
              <UButton
                v-if="row.original.hasRegistry"
                color="error"
                variant="ghost"
                icon="i-solar-trash-bin-minimalistic-bold-duotone"
                size="xs"
                @click="deleteLobby(row.original)"
                class="rounded-full"
                :tooltip="{ text: 'Delete database records' }"
              />
              <!-- Full cleanup (both) -->
              <UButton
                v-if="row.original.hasLiveDoc && row.original.hasRegistry"
                color="error"
                variant="soft"
                size="xs"
                @click="fullCleanup(row.original)"
                :tooltip="{ text: 'Full cleanup (GC + delete)' }"
              >
                Full
              </UButton>
            </div>
          </template>
        </UTable>
      </div>

      <!-- Pagination Controls -->
      <div v-if="filteredLobbies.length > pagination.pageSize" class="flex justify-center pt-2">
        <UPagination
          :page="pagination.pageIndex + 1"
          :items-per-page="pagination.pageSize"
          :total="filteredLobbies.length"
          @update:page="setPage"
        />
      </div>
    </div>

    <!-- ═══ SUMMARY ══════════════════════════════════════════════════════ -->
    <div
      v-if="status && filteredLobbies.length > 0"
      class="text-xs text-gray-500 text-center"
    >
      Showing {{ filteredLobbies.length }} of {{ status.lobbies.length }} lobbies
    </div>
  </div>
</template>
