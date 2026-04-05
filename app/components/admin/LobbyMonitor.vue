<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useNotifications } from "~/composables/useNotifications";
import { useUserStore } from "~/stores/userStore";
import type { UnifiedLobby } from "~~/server/utils/mergeLobbies";

interface UnifiedStatusResponse {
  server: {
    version: string;
    uptime: number;
    activeClients: number;
    activeDocuments: number;
    idleDocTtlSec: number;
    memoryUsage: { rss: string; heapUsed: string };
  };
  lobbies: UnifiedLobby[];
}

const { notify } = useNotifications();
const { confirm } = useConfirm();
const userStore = useUserStore();

const authHeaders = () => ({
  Authorization: `Bearer ${userStore.session?.$id}`,
  "x-appwrite-user-id": userStore.user?.$id ?? "",
});

// ── State ─────────────────────────────────────────────────────────────────
const status = ref<UnifiedStatusResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const searchTerm = ref("");
const sourceFilter = ref<"all" | "live" | "orphaned">("all");
const autoRefreshEnabled = ref(true);

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
    status.value = await $fetch<UnifiedStatusResponse>(
      "/api/admin/teleportal/status",
      { headers: authHeaders() },
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
    await $fetch("/api/admin/teleportal/gc", {
      method: "DELETE",
      headers: authHeaders(),
      body: { docId: lobby.teleportal.docId },
    });
    notify({ title: "Lobby Removed", description: `${lobby.code} GC'd from Teleportal`, color: "success" });
    await fetchStatus();
  } catch (err: any) {
    notify({ title: "GC Failed", description: err?.message || "Could not remove lobby", color: "error" });
  }
};

const deleteLobby = async (lobby: UnifiedLobby) => {
  if (!lobby.registry) return;
  const confirmed = await confirm({
    title: "Delete Registry Entry",
    message: `Delete Appwrite records for "${lobbyName(lobby)}"?\n\nThis cascade-deletes players, chat, settings, and the lobby document. Cannot be undone.`,
    confirmButtonText: "Delete",
    confirmButtonColor: "error",
  });
  if (!confirmed) return;
  try {
    await $fetch("/api/admin/lobby/delete", {
      method: "POST",
      headers: authHeaders(),
      body: { lobbyId: lobby.registry.lobbyId },
    });
    notify({ title: "Registry Deleted", description: `${lobby.code} removed from Appwrite`, color: "success" });
    await fetchStatus();
  } catch (err: any) {
    notify({ title: "Delete Failed", description: err?.message || "Could not delete lobby", color: "error" });
  }
};

const markComplete = async (lobby: UnifiedLobby) => {
  if (!lobby.registry) return;
  try {
    await $fetch("/api/admin/lobby/update-status", {
      method: "POST",
      headers: authHeaders(),
      body: { lobbyId: lobby.registry.lobbyId, status: "complete" },
    });
    notify({ title: "Marked Complete", description: `${lobby.code} status set to complete`, color: "success" });
    await fetchStatus();
  } catch (err: any) {
    notify({ title: "Update Failed", description: err?.message || "Could not update status", color: "error" });
  }
};

const fullCleanup = async (lobby: UnifiedLobby) => {
  if (!lobby.teleportal || !lobby.registry) return;
  const confirmed = await confirm({
    title: "Full Cleanup",
    message: `Full cleanup for "${lobbyName(lobby)}"?\n\nThis will GC the live Teleportal doc AND delete all Appwrite records. Cannot be undone.`,
    confirmButtonText: "Full Cleanup",
    confirmButtonColor: "error",
  });
  if (!confirmed) return;
  try {
    await $fetch("/api/admin/teleportal/gc", {
      method: "DELETE",
      headers: authHeaders(),
      body: { docId: lobby.teleportal.docId },
    });
    await $fetch("/api/admin/lobby/delete", {
      method: "POST",
      headers: authHeaders(),
      body: { lobbyId: lobby.registry.lobbyId },
    });
    notify({ title: "Full Cleanup Done", description: `${lobby.code} removed from both systems`, color: "success" });
    await fetchStatus();
  } catch (err: any) {
    notify({ title: "Cleanup Failed", description: err?.message || "Partial cleanup may have occurred", color: "error" });
  }
};

const gcAll = async () => {
  const confirmed = await confirm({
    title: "Force GC All Lobbies",
    message: "Force GC ALL lobbies?\n\nThis will disconnect ALL players from ALL games immediately.",
    confirmButtonText: "Force GC All",
    confirmButtonColor: "error",
  });
  if (!confirmed) return;
  try {
    const result = await $fetch<{ flushed: number; remaining: number }>(
      "/api/admin/teleportal/gc-all",
      { method: "DELETE", headers: authHeaders() },
    );
    notify({
      title: "All Lobbies Flushed",
      description: `${result.flushed} lobby(s) removed, ${result.remaining} client(s) remain`,
      color: "success",
    });
    await fetchStatus();
  } catch (err: any) {
    notify({ title: "GC Failed", description: err?.message || "Could not flush lobbies", color: "error" });
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

onMounted(async () => {
  await fetchStatus();
  if (autoRefreshEnabled.value) startAutoRefresh();
});

onUnmounted(() => {
  stopAutoRefresh();
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
          :tooltip="{ text: 'Force GC all lobbies' }"
        >
          GC All
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

    <!-- ═══ LOBBY LIST ═══════════════════════════════════════════════════ -->
    <div v-else class="space-y-3">
      <div
        v-for="lobby in filteredLobbies"
        :key="lobby.code"
        class="bg-slate-800/50 border rounded-lg p-4 hover:border-slate-600/50 transition-colors"
        :class="{
          'border-slate-700/50': lobby.hasLiveDoc && lobby.hasRegistry,
          'border-l-amber-500 border-l-3 border-slate-700/50': !lobby.hasLiveDoc && lobby.hasRegistry,
          'border-l-red-500 border-l-3 border-slate-700/50': lobby.hasLiveDoc && !lobby.hasRegistry,
        }"
      >
        <div class="flex justify-between items-start">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <!-- Lobby code -->
              <h4 class="text-lg font-mono font-semibold text-white">
                {{ lobby.code }}
              </h4>

              <!-- Phase badge (live only) -->
              <UBadge
                v-if="lobby.teleportal?.phase"
                :color="
                  lobby.teleportal.phase === 'lobby'
                    ? 'info'
                    : ['playing', 'judging', 'submission'].includes(lobby.teleportal.phase)
                      ? 'warning'
                      : ['roundEnd', 'gameOver'].includes(lobby.teleportal.phase)
                        ? 'success'
                        : 'neutral'
                "
                size="md"
              >
                {{ lobby.teleportal.phase }}
              </UBadge>

              <!-- WS count (live only) -->
              <UBadge
                v-if="lobby.teleportal"
                color="primary"
                variant="subtle"
                size="md"
              >
                {{ lobby.teleportal.clients }} ws
              </UBadge>

              <!-- Round (live only) -->
              <UBadge
                v-if="lobby.teleportal?.round"
                color="info"
                variant="subtle"
                size="md"
              >
                round {{ lobby.teleportal.round }}
              </UBadge>

              <!-- Live indicator -->
              <UBadge
                v-if="lobby.hasLiveDoc && lobby.hasRegistry"
                color="success"
                variant="subtle"
                size="md"
              >
                ● live
              </UBadge>

              <!-- Registry status -->
              <UBadge
                v-if="lobby.registry"
                :color="
                  lobby.registry.status === 'complete'
                    ? 'success'
                    : lobby.registry.status === 'playing'
                      ? 'warning'
                      : 'info'
                "
                size="md"
              >
                {{ lobby.registry.status }}
              </UBadge>

              <!-- Idle warning (live only) -->
              <UBadge
                v-if="lobby.teleportal && lobby.teleportal.idleSec > 30"
                color="warning"
                variant="subtle"
                size="md"
              >
                idle {{ lobby.teleportal.idleSec }}s
              </UBadge>

              <!-- Orphan/ghost warnings -->
              <UBadge
                v-if="!lobby.hasLiveDoc && lobby.hasRegistry"
                color="warning"
                size="md"
              >
                ⚠ orphaned
              </UBadge>
              <UBadge
                v-if="lobby.hasLiveDoc && !lobby.hasRegistry"
                color="error"
                size="md"
              >
                ⚠ no registry
              </UBadge>
            </div>

            <!-- Subtitle -->
            <p class="text-xs text-gray-400 mt-1">
              <span v-if="lobby.registry?.lobbyName || lobby.teleportal?.meta?.lobbyName">
                {{ lobby.registry?.lobbyName || lobby.teleportal?.meta?.lobbyName }}
              </span>
              <span v-if="(lobby.registry?.lobbyName || lobby.teleportal?.meta?.lobbyName) && lobby.teleportal?.meta?.hostName" class="mx-1">·</span>
              <span v-if="lobby.teleportal?.meta?.hostName">
                Host: {{ lobby.teleportal.meta.hostName }}
              </span>
              <span v-if="lobby.registry?.createdAt">
                <span class="mx-1">·</span>
                Created {{ new Date(lobby.registry.createdAt).toLocaleString() }}
              </span>
            </p>
          </div>

          <!-- ── Actions ────────────────────────────────────────── -->
          <div class="flex items-center gap-1 flex-shrink-0">
            <!-- Mark Complete -->
            <UButton
              v-if="lobby.registry && lobby.registry.status !== 'complete'"
              color="warning"
              variant="ghost"
              icon="i-solar-check-circle-bold-duotone"
              size="xs"
              @click="markComplete(lobby)"
              class="rounded-full"
              :tooltip="{ text: 'Mark as completed' }"
            />
            <!-- GC Teleportal doc -->
            <UButton
              v-if="lobby.hasLiveDoc"
              color="error"
              variant="ghost"
              icon="i-solar-trash-bin-trash-bold-duotone"
              size="xs"
              @click="gcLobby(lobby)"
              class="rounded-full"
              :tooltip="{ text: 'GC Teleportal doc' }"
            />
            <!-- Delete Appwrite registry -->
            <UButton
              v-if="lobby.hasRegistry"
              color="error"
              variant="ghost"
              icon="i-solar-trash-bin-minimalistic-bold-duotone"
              size="xs"
              @click="deleteLobby(lobby)"
              class="rounded-full"
              :tooltip="{ text: 'Delete Appwrite records' }"
            />
            <!-- Full cleanup (both) -->
            <UButton
              v-if="lobby.hasLiveDoc && lobby.hasRegistry"
              color="error"
              variant="soft"
              size="xs"
              @click="fullCleanup(lobby)"
              :tooltip="{ text: 'Full cleanup (GC + delete)' }"
            >
              Full
            </UButton>
          </div>
        </div>

        <!-- ── Players (live only) ──────────────────────────────── -->
        <div v-if="lobby.teleportal" class="mt-3">
          <p
            v-if="!lobby.teleportal.players.length"
            class="text-sm text-gray-500 italic"
          >
            No players synced yet
          </p>
          <ul v-else class="flex flex-wrap gap-2">
            <li
              v-for="player in lobby.teleportal.players"
              :key="player.id"
              class="text-xs text-white bg-slate-700/70 px-2 py-1 rounded flex items-center gap-1.5"
            >
              <img
                v-if="player.avatar"
                :src="player.avatar"
                :alt="player.name"
                class="w-4 h-4 rounded-full"
              />
              <span>{{ player.name }}</span>
              <UBadge
                v-if="player.isBot"
                color="warning"
                variant="subtle"
                size="md"
              >
                Bot
              </UBadge>
            </li>
          </ul>
        </div>
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
