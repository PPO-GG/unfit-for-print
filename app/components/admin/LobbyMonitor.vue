<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { getAppwrite } from "~/utils/appwrite";
import { Query } from "appwrite";
import type { Databases } from "appwrite";
import { useNotifications } from "~/composables/useNotifications";
import type { GameSettings } from "~/types/gamesettings";
import type { Lobby } from "~/types/lobby";
import { resolveId } from "~/utils/resolveId";

// Extended Lobby type that includes the lobbyName property
type LobbyWithName = Lobby & {
  lobbyName?: string | null;
};

// Teleportal live lobby types
interface TeleportalPlayer {
  id: string;
  name: string;
  avatar?: string;
  isBot?: boolean;
}

interface TeleportalLobby {
  docId: string;
  lobbyCode: string;
  clients: number;
  idleSec: number;
  players: TeleportalPlayer[];
  meta: Record<string, any>;
  phase?: string;
}

interface TeleportalStatus {
  version: string;
  uptime: number;
  activeClients: number;
  activeDocuments: number;
  idleDocTtlSec: number;
  documents: Record<
    string,
    {
      clients: number;
      idleSec: number;
      players: TeleportalPlayer[];
      meta: Record<string, any>;
      phase?: string;
    }
  >;
  memoryUsage: { rss: string; heapUsed: string };
  timestamp: number;
}

const { databases, tables } = getAppwrite();

function getDb(): Databases {
  if (!databases) throw new Error("Databases not initialized");
  return databases;
}

const config = useRuntimeConfig();
const { notify } = useNotifications();

const DB_ID = config.public.appwriteDatabaseId;
const LOBBY_COL = config.public.appwriteLobbyCollectionId;
const PLAYER_COL = config.public.appwritePlayerCollectionId;

const lobbies = ref<LobbyWithName[]>([]);
const playersByLobby = ref<Record<string, any[]>>({});
const loading = ref(true);
const searchTerm = ref("");
const statusFilter = ref<string | null>(null);
const totalLobbies = ref(0);
const currentPage = ref(1);
const pageSize = ref(5);

// ── Teleportal Live State ──────────────────────────────────────────────────
const teleportalStatus = ref<TeleportalStatus | null>(null);
const teleportalLobbies = ref<TeleportalLobby[]>([]);
const teleportalLoading = ref(false);
const teleportalError = ref<string | null>(null);

// Derive the HTTP base URL from the WS-based lobbyTeleportalUrl
const teleportalHttpUrl = computed(() => {
  const wsUrl = config.public.lobbyTeleportalUrl || "ws://localhost:1235";
  return wsUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
});

// Status options for filter
const statusOptions = ["waiting", "active", "complete"];

// Filtered lobbies based on search term and status
const filteredLobbies = computed(() => {
  if (!searchTerm.value && !statusFilter.value) return lobbies.value;

  return lobbies.value.filter((lobby) => {
    const matchesSearch =
      !searchTerm.value ||
      (lobby.lobbyName?.toLowerCase() || "").includes(
        searchTerm.value.toLowerCase(),
      ) ||
      lobby.$id.toLowerCase().includes(searchTerm.value.toLowerCase());

    const matchesStatus =
      !statusFilter.value || lobby.status === statusFilter.value;

    return matchesSearch && matchesStatus;
  });
});

// Paginated lobbies
const paginatedLobbies = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredLobbies.value.slice(start, end);
});

// Total pages for pagination
const totalPages = computed(() => {
  return Math.ceil(filteredLobbies.value.length / pageSize.value);
});

// Format uptime nicely
function formatUptime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

// ── Teleportal Fetch ─────────────────────────────────────────────────────────

const fetchTeleportalStatus = async () => {
  teleportalLoading.value = true;
  teleportalError.value = null;
  try {
    const response = await $fetch<TeleportalStatus>(
      `${teleportalHttpUrl.value}/status`,
    );
    teleportalStatus.value = response;

    // Convert documents map to sorted array
    const lobbiesArr: TeleportalLobby[] = [];
    for (const [docId, details] of Object.entries(response.documents || {})) {
      lobbiesArr.push({
        docId,
        lobbyCode: docId.replace(/^lobby-/, ""),
        ...details,
      });
    }
    // Sort by client count descending, then by idle time ascending
    lobbiesArr.sort((a, b) => b.clients - a.clients || a.idleSec - b.idleSec);
    teleportalLobbies.value = lobbiesArr;
  } catch (err: any) {
    console.error("[Admin] Failed to fetch Teleportal status:", err);
    teleportalError.value = err?.message || "Failed to connect";
    teleportalStatus.value = null;
    teleportalLobbies.value = [];
  } finally {
    teleportalLoading.value = false;
  }
};

// Force-remove a single Teleportal lobby
const forceRemoveLobby = async (docId: string) => {
  if (
    !confirm(
      `Force-remove lobby "${docId}"?\n\nThis will disconnect all players and destroy the game state immediately.`,
    )
  ) {
    return;
  }
  try {
    await $fetch(`${teleportalHttpUrl.value}/gc/${encodeURIComponent(docId)}`, {
      method: "DELETE",
    });
    notify({
      title: "Lobby Removed",
      description: `${docId} was force-removed from the Teleportal server`,
      color: "success",
    });
    // Refresh the list
    await fetchTeleportalStatus();
  } catch (err: any) {
    console.error("[Admin] Failed to remove lobby:", err);
    notify({
      title: "Remove Failed",
      description: err?.message || "Could not remove lobby",
      color: "error",
    });
  }
};

// Force GC ALL Teleportal lobbies
const forceGcAll = async () => {
  if (
    !confirm(
      `Force GC ALL lobbies?\n\nThis will disconnect ALL players from ALL games immediately.`,
    )
  ) {
    return;
  }
  try {
    const result = await $fetch<{ flushed: number; remaining: number }>(
      `${teleportalHttpUrl.value}/gc`,
      { method: "POST" },
    );
    notify({
      title: "All Lobbies Flushed",
      description: `${result.flushed} lobby(s) removed, ${result.remaining} client(s) remain`,
      color: "success",
    });
    await fetchTeleportalStatus();
  } catch (err: any) {
    console.error("[Admin] Failed to GC all:", err);
    notify({
      title: "GC Failed",
      description: err?.message || "Could not flush lobbies",
      color: "error",
    });
  }
};

const checkActiveLobbies = async () => {
  if (!databases) return;
  loading.value = true;
  try {
    // 1. Fetch all lobbies, ordered by creation date
    const lobbyRes = await tables.listRows({
      databaseId: DB_ID,
      tableId: LOBBY_COL,
      queries: [Query.orderDesc("$createdAt"), Query.limit(100)],
    });

    // Store the raw lobbies temporarily
    const rawLobbies = lobbyRes.rows;
    totalLobbies.value = lobbyRes.total;

    // 2. Fetch game settings for all lobbies
    const GAMESETTINGS_COL = config.public.appwriteGameSettingsCollectionId;
    const settingsRes = await tables.listRows({
      databaseId: DB_ID,
      tableId: GAMESETTINGS_COL,
      queries: [
        Query.limit(1000), // or adjust as needed
      ],
    });

    // Create a map of lobbyId to settings
    const settingsMap: Record<string, GameSettings> = {};
    for (const setting of settingsRes.rows) {
      // Handle case where lobbyId is a relationship object
      const lobbyIdKey = resolveId(setting.lobbyId);
      settingsMap[lobbyIdKey] = setting as unknown as GameSettings;
    }

    // 3. Merge lobby names into lobby objects
    lobbies.value = rawLobbies.map((lobby: any) => {
      // First try direct lookup
      let settings = settingsMap[lobby.$id];

      // If settings not found by exact match, try to find by string comparison
      if (!settings) {
        const matchingSettings = settingsRes.rows.find(
          (s: any) => String(s.lobbyId) === String(lobby.$id),
        );
        if (matchingSettings) {
          settings = matchingSettings as unknown as GameSettings;
        }
      }

      return {
        ...lobby,
        lobbyName: settings?.lobbyName || null,
      } as unknown as LobbyWithName;
    });

    // 4. For each lobby, fetch players
    const allPlayersRes = await tables.listRows({
      databaseId: DB_ID,
      tableId: PLAYER_COL,
      queries: [
        Query.limit(1000), // or page through if more
      ],
    });

    const playersMap: Record<string, any[]> = {};
    for (const player of allPlayersRes.rows) {
      const lobbyIdKey = player.lobbyId as string;
      if (!lobbyIdKey) continue;
      if (!playersMap[lobbyIdKey]) playersMap[lobbyIdKey] = [];
      playersMap[lobbyIdKey].push(player);
    }

    playersByLobby.value = playersMap;

    // Reset filters when refreshing
    currentPage.value = 1;
  } catch (err) {
    console.error("Failed to load lobbies or players:", err);
    notify({
      title: "Error",
      description: "Failed to load lobbies or players",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

// Mark a lobby as completed
const markLobbyCompleted = async (lobby: LobbyWithName) => {
  try {
    const updated = await getDb().updateDocument(DB_ID, LOBBY_COL, lobby.$id, {
      status: "complete",
    });

    // Update in local list
    const index = lobbies.value.findIndex((l) => l.$id === updated.$id);
    if (index !== -1) {
      (lobbies.value[index] as any).status = updated.status;
    }

    notify({
      title: "Lobby Marked Completed",
      description: `Lobby "${lobby.lobbyName || "Unnamed"}" marked as completed`,
      color: "success",
    });
  } catch (err) {
    console.error("Failed to update lobby:", err);
    notify({
      title: "Update Failed",
      description: "Could not mark lobby as completed",
      color: "error",
    });
  }
};

// Delete a lobby
const deleteLobby = async (lobby: LobbyWithName) => {
  if (
    !confirm(
      `Are you sure you want to delete this lobby?\n\n"${lobby.lobbyName || "Unnamed Lobby"}"\n\nThis will also delete all associated players, game chat messages, and game settings. This cannot be undone.`,
    )
  ) {
    return;
  }

  try {
    // First delete all players in this lobby
    const playersInLobby = playersByLobby.value[lobby.$id] || [];
    for (const player of playersInLobby) {
      await getDb().deleteDocument(DB_ID, PLAYER_COL, player.$id);
    }

    // Delete associated game chat messages
    const GAMECHAT_COL = config.public.appwriteGamechatCollectionId;
    // When querying with Query.equal, Appwrite will match both string values and relationship IDs
    const chatMessages = await getDb().listDocuments(DB_ID, GAMECHAT_COL, [
      Query.equal("lobbyId", lobby.$id),
    ]);
    for (const message of chatMessages.documents) {
      await getDb().deleteDocument(DB_ID, GAMECHAT_COL, message.$id);
    }

    // Delete associated game settings
    const GAMESETTINGS_COL = config.public.appwriteGameSettingsCollectionId;
    // When querying with Query.equal, Appwrite will match both string values and relationship IDs
    const gameSettings = await getDb().listDocuments(DB_ID, GAMESETTINGS_COL, [
      Query.equal("lobbyId", lobby.$id),
    ]);
    for (const setting of gameSettings.documents) {
      await getDb().deleteDocument(DB_ID, GAMESETTINGS_COL, setting.$id);
    }

    // Then delete the lobby
    await getDb().deleteDocument(DB_ID, LOBBY_COL, lobby.$id);

    // Remove from local lists
    lobbies.value = lobbies.value.filter((l) => l.$id !== lobby.$id);
    delete playersByLobby.value[lobby.$id];

    notify({
      title: "Lobby Deleted",
      description: `Lobby "${lobby.lobbyName || "Unnamed"}" and all associated data were deleted`,
      color: "success",
    });
  } catch (err) {
    console.error("Failed to delete lobby:", err);
    notify({
      title: "Delete Failed",
      description: "Could not delete the lobby",
      color: "error",
    });
  }
};

// Reset filters
const resetFilters = () => {
  searchTerm.value = "";
  statusFilter.value = null;
  currentPage.value = 1;
};

onMounted(async () => {
  await Promise.all([checkActiveLobbies(), fetchTeleportalStatus()]);
});

// Watch for filter changes to reset pagination
watch([searchTerm, statusFilter], () => {
  currentPage.value = 1;
});
</script>

<template>
  <div class="space-y-6">
    <!-- ═══ TELEPORTAL LIVE LOBBIES ═══════════════════════════════════════ -->
    <div>
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <h3 class="text-lg font-semibold text-white">
            Live Teleportal Lobbies
          </h3>
          <UBadge
            v-if="teleportalStatus"
            color="success"
            variant="subtle"
            size="xs"
          >
            v{{ teleportalStatus.version }}
          </UBadge>
        </div>
        <div class="flex items-center gap-2">
          <!-- Server stats -->
          <template v-if="teleportalStatus">
            <UBadge color="neutral" variant="subtle" size="xs">
              {{ teleportalStatus.activeClients }} client(s)
            </UBadge>
            <UBadge color="neutral" variant="subtle" size="xs">
              Up {{ formatUptime(teleportalStatus.uptime) }}
            </UBadge>
            <UBadge color="neutral" variant="subtle" size="xs">
              {{ teleportalStatus.memoryUsage.rss }}
            </UBadge>
          </template>

          <UButton
            color="error"
            variant="soft"
            size="xs"
            icon="i-solar-trash-bin-minimalistic-bold-duotone"
            @click="forceGcAll"
            :disabled="!teleportalLobbies.length"
            :tooltip="{ text: 'Force GC all lobbies' }"
          >
            GC All
          </UButton>
          <UButton
            loading-auto
            @click="fetchTeleportalStatus"
            color="secondary"
            variant="soft"
            size="xs"
            icon="i-solar-refresh-broken"
          >
            Refresh
          </UButton>
        </div>
      </div>

      <!-- Error State -->
      <div
        v-if="teleportalError"
        class="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-center"
      >
        <UIcon
          name="i-solar-shield-warning-bold-duotone"
          class="h-8 w-8 mx-auto text-red-400 mb-2"
        />
        <p class="text-red-300 text-sm">{{ teleportalError }}</p>
        <p class="text-red-400/60 text-xs mt-1">
          Server: {{ teleportalHttpUrl }}
        </p>
      </div>

      <!-- Loading -->
      <div v-else-if="teleportalLoading && !teleportalStatus" class="space-y-3">
        <div
          v-for="i in 2"
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

      <!-- Empty State -->
      <div
        v-else-if="teleportalLobbies.length === 0"
        class="bg-slate-800/30 border border-slate-700/30 rounded-lg p-6 text-center"
      >
        <UIcon
          name="i-solar-server-minimalistic-line-duotone"
          class="h-10 w-10 mx-auto text-gray-500 mb-2"
        />
        <p class="text-gray-400 text-sm">
          No active lobbies on the Teleportal server.
        </p>
      </div>

      <!-- Live Lobbies Grid -->
      <div v-else class="space-y-3">
        <div
          v-for="lobby in teleportalLobbies"
          :key="lobby.docId"
          class="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600/50 transition-colors"
        >
          <div class="flex justify-between items-start">
            <div>
              <div class="flex items-center gap-2">
                <h4 class="text-lg font-mono font-semibold text-white">
                  {{ lobby.lobbyCode }}
                </h4>
                <UBadge
                  v-if="lobby.phase"
                  :color="
                    lobby.phase === 'lobby'
                      ? 'info'
                      : lobby.phase === 'playing' ||
                          lobby.phase === 'judging' ||
                          lobby.phase === 'submission'
                        ? 'warning'
                        : lobby.phase === 'roundEnd' ||
                            lobby.phase === 'gameOver'
                          ? 'success'
                          : 'neutral'
                  "
                  size="xs"
                >
                  {{ lobby.phase }}
                </UBadge>
                <UBadge color="primary" variant="subtle" size="xs">
                  {{ lobby.clients }} ws
                </UBadge>
                <UBadge
                  v-if="lobby.idleSec > 30"
                  color="warning"
                  variant="subtle"
                  size="xs"
                >
                  idle {{ lobby.idleSec }}s
                </UBadge>
              </div>
              <p
                v-if="lobby.meta.hostName || lobby.meta.lobbyName"
                class="text-xs text-gray-400 mt-1"
              >
                <span v-if="lobby.meta.lobbyName">
                  {{ lobby.meta.lobbyName }}
                </span>
                <span
                  v-if="lobby.meta.lobbyName && lobby.meta.hostName"
                  class="mx-1"
                  >·</span
                >
                <span v-if="lobby.meta.hostName">
                  Host: {{ lobby.meta.hostName }}
                </span>
              </p>
            </div>

            <div class="flex items-center gap-1">
              <UButton
                color="error"
                variant="ghost"
                icon="i-solar-trash-bin-trash-bold-duotone"
                size="xs"
                @click="forceRemoveLobby(lobby.docId)"
                class="rounded-full"
                :tooltip="{ text: 'Force remove this lobby' }"
              />
            </div>
          </div>

          <!-- Players -->
          <div class="mt-3">
            <p
              v-if="!lobby.players.length"
              class="text-sm text-gray-500 italic"
            >
              No players synced yet
            </p>
            <ul v-else class="flex flex-wrap gap-2">
              <li
                v-for="player in lobby.players"
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
                  size="xs"
                >
                  Bot
                </UBadge>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ APPWRITE DATABASE LOBBIES ═════════════════════════════════════ -->
    <div>
      <h3 class="text-lg font-semibold text-white mb-3">
        Database Lobbies (Appwrite)
      </h3>

      <!-- Search and Filter Controls -->
      <div class="flex flex-col md:flex-row gap-4">
        <div class="flex gap-4 flex-1">
          <UInput
            v-model="searchTerm"
            placeholder="Search lobbies..."
            class="flex-1"
            icon="i-solar-magnifer-broken"
          />
          <USelectMenu
            :items="statusOptions"
            placeholder="Filter by status"
            clearable
            v-model="statusFilter as any"
          />
        </div>
        <div class="flex gap-2">
          <UButton
            @click="resetFilters"
            color="neutral"
            variant="soft"
            icon="i-solar-close-circle-line-duotone"
            :disabled="!searchTerm && !statusFilter"
          >
            Clear
          </UButton>
          <UButton
            loading-auto
            @click="checkActiveLobbies"
            color="secondary"
            variant="soft"
            icon="i-solar-refresh-broken"
          >
            Refresh
          </UButton>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="space-y-3 mt-4">
        <!-- Skeleton cards -->
        <div
          v-for="i in 5"
          :key="i"
          class="bg-slate-700 rounded p-4 flex justify-between items-center relative"
        >
          <div class="max-w-xl mb-4 w-full">
            <USkeleton class="h-5 w-full" />
            <USkeleton class="h-5 w-3/4 mt-2" />
          </div>
          <div class="flex gap-2 absolute left-0 bottom-0 m-2">
            <span class="ml-2 flex items-center">
              <USkeleton class="h-4 w-20" />
            </span>
            <span class="ml-2 flex items-center">
              <USkeleton class="h-4 w-20" />
            </span>
          </div>
          <div class="flex items-center gap-1">
            <USkeleton class="h-8 w-8 rounded" />
            <USkeleton class="h-8 w-8 rounded" />
            <USkeleton class="h-8 w-8 rounded" />
            <USkeleton class="h-8 w-8 rounded" />
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!lobbies.length" class="text-center py-8">
        <UIcon
          name="i-solar-users-group-rounded-bold-duotone"
          class="h-12 w-12 mx-auto text-gray-400 mb-2"
        />
        <p class="text-gray-400">No lobbies found.</p>
      </div>

      <!-- No Results State -->
      <div v-else-if="filteredLobbies.length === 0" class="text-center py-8">
        <p class="text-gray-400">No lobbies match your search criteria.</p>
        <UButton
          class="mt-2"
          color="neutral"
          variant="ghost"
          @click="resetFilters"
        >
          Clear Filters
        </UButton>
      </div>

      <!-- Lobbies List -->
      <ul v-else class="space-y-4 mt-4">
        <li
          v-for="lobby in paginatedLobbies"
          :key="lobby.$id"
          class="bg-slate-800 p-4 rounded shadow"
        >
          <div class="flex justify-between items-start">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-2xl font-semibold">
                  {{ lobby.lobbyName || "Unnamed Lobby" }}
                </h3>
                <UBadge
                  class="text-sm text-white font-light"
                  :color="
                    lobby.status === 'complete'
                      ? 'success'
                      : lobby.status === 'playing'
                        ? 'warning'
                        : 'info'
                  "
                >
                  {{ lobby.status }}
                </UBadge>
              </div>
              <p class="text-sm text-gray-400">
                Created: {{ new Date(lobby.$createdAt).toLocaleString() }}
                <span class="mx-1">|</span>
                ID: <span class="font-mono">{{ lobby.$id }}</span>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <UBadge color="primary"
                >{{ playersByLobby[lobby.$id]?.length || 0 }} players</UBadge
              >
              <div class="flex gap-1">
                <UButton
                  v-if="lobby.status !== 'complete'"
                  color="warning"
                  variant="ghost"
                  icon="i-solar-check-circle-bold-duotone"
                  size="xs"
                  @click="markLobbyCompleted(lobby)"
                  class="rounded-full"
                  :tooltip="{ text: 'Mark as completed' }"
                />
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-solar-trash-bin-trash-bold-duotone"
                  size="xs"
                  @click="deleteLobby(lobby)"
                  class="rounded-full"
                  :tooltip="{ text: 'Delete lobby' }"
                />
              </div>
            </div>
          </div>

          <!-- Players List -->
          <div class="mt-3">
            <p
              v-if="!playersByLobby[lobby.$id]?.length"
              class="text-sm text-gray-400"
            >
              No players in this lobby.
            </p>
            <ul v-else class="flex flex-wrap gap-2">
              <li
                v-for="player in playersByLobby[lobby.$id] || []"
                :key="player.$id"
                class="text-xs text-white bg-slate-700 px-2 py-1 rounded flex items-center gap-1"
              >
                <span>{{ player.name }}</span>
                <UBadge
                  v-if="player.provider === 'discord'"
                  color="info"
                  size="xs"
                  >Discord</UBadge
                >
                <UBadge v-else color="neutral" size="xs">Anonymous</UBadge>
              </li>
            </ul>
          </div>
        </li>
      </ul>

      <!-- Pagination -->
      <div
        v-if="filteredLobbies.length > pageSize"
        class="flex justify-between items-center mt-4"
      >
        <div class="text-sm text-gray-400">
          Showing {{ (currentPage - 1) * pageSize + 1 }}-{{
            Math.min(currentPage * pageSize, filteredLobbies.length)
          }}
          of {{ filteredLobbies.length }} lobbies
        </div>
        <UPagination
          v-model:page="currentPage"
          :total="filteredLobbies.length"
          :page-count="totalPages"
          :page-size="pageSize"
          class="flex items-center gap-1"
        />
      </div>
    </div>
  </div>
</template>
