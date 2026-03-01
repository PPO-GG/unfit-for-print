<template>
  <div class="flex flex-col items-center justify-start text-white">
    <!-- ── Hero Section ─────────────────────────────────────────── -->
    <div
      class="w-full flex flex-col items-center justify-center pt-6 pb-10 px-6 text-center z-10"
    >
      <!-- Logo / Icon -->
      <h1
        class="text-5xl sm:text-6xl font-black uppercase tracking-tight leading-tight drop-shadow-xl"
      >
        {{ t("game.available") }}
      </h1>

      <!-- Primary CTAs -->
      <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
        <UButton
          size="xl"
          variant="subtle"
          color="primary"
          icon="i-solar-hand-shake-line-duotone"
          class="text-base font-bold uppercase tracking-wider text-xl"
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
            class="text-base font-bold uppercase tracking-wider text-xl"
            @click="showCreate = true"
          >
            {{ t("modal.create_lobby") }}
          </UButton>
        </ClientOnly>
      </div>
    </div>

    <!-- ── Lobby Browser ─────────────────────────────────────────── -->
    <div class="w-full max-w-3xl px-4 pb-20 z-10">
      <!-- Section header -->
      <div class="flex items-center justify-between mb-4 px-1">
        <h2 class="text-xs font-bold uppercase tracking-widest text-slate-400">
          {{ t("game.available") }}
        </h2>
        <span
          class="text-xs font-bold uppercase tracking-widest text-slate-400 tabular-nums"
        >
          {{ lobbies.length }} {{ lobbies.length === 1 ? "lobby" : "lobbies" }}
        </span>
      </div>

      <!-- Lobby List -->
      <ul v-if="lobbies.length" class="space-y-3">
        <li
          v-for="lobby in lobbies"
          :key="lobby.$id"
          class="group relative flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-slate-800/50 backdrop-blur-md px-5 py-4 shadow-lg transition-all duration-200 hover:border-violet-500/40 hover:bg-slate-800/70 hover:shadow-violet-900/30"
        >
          <!-- Subtle glow on hover -->
          <div
            class="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-violet-500/5 to-transparent"
          />

          <!-- Left: Info -->
          <div class="flex items-center gap-4 min-w-0">
            <!-- Host avatar -->
            <div
              class="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-violet-900/40 border border-violet-500/20 text-violet-300 overflow-hidden"
            >
              <img
                v-if="getHostAvatar(lobby)"
                :src="getHostAvatar(lobby)!"
                :alt="getHostName(lobby)"
                class="w-full h-full object-cover"
              />
              <span
                v-else
                class="i-solar-users-group-rounded-bold-duotone text-xl"
              />
            </div>

            <div class="min-w-0">
              <h3 class="text-sm font-bold truncate text-white leading-tight">
                {{ lobby.lobbyName || t("lobby.no_name") }}
              </h3>
              <div class="flex items-center gap-2 mt-1 flex-wrap">
                <!-- Lobby code badge -->
                <span
                  class="inline-flex items-center gap-1 text-xs font-mono text-slate-400"
                >
                  <span
                    class="i-solar-key-minimalistic-2-bold-duotone text-slate-500"
                  />
                  {{ lobby.code }}
                </span>
                <!-- Host name -->
                <span
                  class="inline-flex items-center gap-1 text-xs text-slate-500"
                >
                  <span
                    class="i-solar-crown-minimalistic-bold-duotone text-amber-500/70"
                  />
                  {{ getHostName(lobby) }}
                </span>
              </div>

              <!-- Player avatar stack -->
              <div
                v-if="lobbyPlayers[lobby.$id]?.length"
                class="flex items-center gap-1 mt-2"
              >
                <div class="flex items-center -space-x-1.5">
                  <div
                    v-for="player in lobbyPlayers[lobby.$id]!.slice(0, 6)"
                    :key="player.$id"
                    class="relative shrink-0 w-6 h-6 rounded-full border-2 border-slate-800 overflow-hidden bg-slate-700"
                    :title="player.name"
                  >
                    <img
                      v-if="player.avatar"
                      :src="player.avatar"
                      :alt="player.name"
                      class="w-full h-full object-cover"
                    />
                    <span
                      v-else
                      class="flex items-center justify-center w-full h-full text-[10px] font-bold text-slate-400 uppercase"
                    >
                      {{ player.name?.charAt(0) || "?" }}
                    </span>
                    <!-- Bot indicator -->
                    <span
                      v-if="player.playerType === 'bot'"
                      class="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-3 h-3 rounded-full bg-slate-900 border border-slate-700"
                    >
                      <span
                        class="i-solar-bot-minimalistic-bold-duotone text-[8px] text-cyan-400"
                      />
                    </span>
                    <!-- Host crown -->
                    <span
                      v-else-if="player.isHost"
                      class="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-3 h-3 rounded-full bg-slate-900 border border-slate-700"
                    >
                      <span
                        class="i-solar-crown-minimalistic-bold-duotone text-[8px] text-amber-400"
                      />
                    </span>
                  </div>
                </div>
                <!-- Overflow count -->
                <span
                  v-if="lobbyPlayers[lobby.$id]!.length > 6"
                  class="text-[10px] font-semibold text-slate-500 ml-1"
                >
                  +{{ lobbyPlayers[lobby.$id]!.length - 6 }}
                </span>
                <!-- Player count -->
                <span class="text-[10px] text-slate-500 ml-1 tabular-nums">
                  {{ lobbyPlayers[lobby.$id]!.length }}
                  {{
                    lobbyPlayers[lobby.$id]!.length === 1 ? "player" : "players"
                  }}
                </span>
              </div>
            </div>
          </div>

          <!-- Right: Status + Join -->
          <div class="flex items-center gap-3 shrink-0">
            <!-- Status badge -->
            <span
              class="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border"
              :class="
                lobby.status === 'waiting'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              "
            >
              <span
                class="inline-block w-1.5 h-1.5 rounded-full"
                :class="
                  lobby.status === 'waiting' ? 'bg-emerald-400' : 'bg-amber-400'
                "
              />
              {{ lobby.status }}
            </span>

            <UButton
              size="sm"
              variant="soft"
              color="primary"
              icon="i-solar-arrow-right-bold-duotone"
              trailing
              class="font-semibold uppercase tracking-wide text-xs"
              @click="handleJoined(lobby.code)"
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

    <!-- ── Modals ─────────────────────────────────────────────────── -->
    <UModal v-model:open="showJoin" :title="t('modal.join_lobby')">
      <template #body>
        <JoinLobbyForm @joined="handleJoined" />
      </template>
    </UModal>

    <UModal v-model:open="showCreate" :title="t('modal.create_lobby')">
      <template #body>
        <CreateLobbyDialog @created="handleJoined" />
      </template>
    </UModal>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from "vue";
import { usePlayers } from "~/composables/usePlayers";
import type { Player } from "~/types/player";
import { useRouter } from "vue-router";
import { useUserStore } from "~/stores/userStore";
import { useLobby } from "~/composables/useLobby";
import { useUserAccess } from "~/composables/useUserUtils";
import { getAppwrite } from "~/utils/appwrite";
import { Query } from "appwrite";
import type { TablesDB } from "appwrite";
import { useGetPlayerName } from "~/composables/useGetPlayerName";
import type { GameSettings } from "~/types/gamesettings";
import type { Lobby } from "~/types/lobby";
import { resolveId } from "~/utils/resolveId";
import { useI18n } from "vue-i18n";
const { t } = useI18n();

let tables: TablesDB | undefined;
if (import.meta.client) {
  ({ tables } = getAppwrite());
}
const config = useRuntimeConfig();
const showJoin = ref(false);
const showCreate = ref(false);
const { getPlayerName, getPlayerNameSync, playerCache } = useGetPlayerName();

const DB_ID = config.public.appwriteDatabaseId;
const LOBBY_COL = config.public.appwriteLobbyCollectionId;
const GAMESETTINGS_COL = config.public.appwriteGameSettingsCollectionId;

type LobbyWithName = Lobby & {
  lobbyName?: string | null;
  hostName?: string;
};
const lobbies = ref<LobbyWithName[]>([]);

const router = useRouter();
const userStore = useUserStore();
const { getActiveLobbyForUser } = useLobby();
const { showIfAuthenticated } = useUserAccess();
const { getPlayersForLobby } = usePlayers();
const hostNames = ref<Record<string, string>>({});
const lobbyPlayers = ref<Record<string, Player[]>>({});

const fetchPublicLobbies = async () => {
  if (!tables) return;
  try {
    const lobbyRes = await tables.listRows<Lobby>({
      databaseId: DB_ID,
      tableId: LOBBY_COL,
      queries: [
        Query.equal("status", "waiting"),
        Query.orderDesc("$createdAt"),
        Query.limit(100),
      ],
    });

    const settingsRes = await tables.listRows<GameSettings>({
      databaseId: DB_ID,
      tableId: GAMESETTINGS_COL,
      queries: [Query.limit(1000)],
    });

    const settingsMap: Record<string, GameSettings> = {};
    for (const setting of settingsRes.rows) {
      const lobbyId = resolveId(setting.lobbyId);
      settingsMap[lobbyId] = setting;
    }

    const publicLobbies: LobbyWithName[] = [];

    for (const lobby of lobbyRes.rows) {
      const settings = settingsMap[lobby.$id];
      if (!settings || settings.isPrivate) continue;

      // Start fetching the host name in the background
      if (lobby.hostUserId) {
        getPlayerName(lobby.hostUserId).then((name) => {
          hostNames.value[lobby.hostUserId] = name;
        });
      }

      // Fetch all players for this lobby in the background
      getPlayersForLobby(lobby.$id).then((players) => {
        lobbyPlayers.value[lobby.$id] = players;
      });

      publicLobbies.push({
        ...lobby,
        lobbyName: settings.lobbyName || "Unnamed Lobby",
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
    await userStore.fetchUserSession();
  }
  await fetchPublicLobbies();
  const userId = userStore.user?.$id;
  if (userId) {
    const activeLobby = await getActiveLobbyForUser(userId);
    if (activeLobby?.code) {
      return router.replace(`/game/${activeLobby.code}`);
    }
  }
});

const handleJoined = (code: string) => {
  return router.replace(`/game/${code}`);
};
</script>
