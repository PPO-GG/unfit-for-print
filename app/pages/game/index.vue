<template>
  <div
    class="p-6 space-y-6 text-white flex justify-center items-center text-center flex-col align-middle"
  >
    <div
      class="backdrop-blur-2xl bg-slate-800/25 p-16 rounded-xl shadow-xl flex flex-col items-center space-y-4"
    >
      <h1 class="text-4xl font-bold font-['Bebas_Neue']">
        {{ t("game.available") }}
      </h1>

      <ul v-if="lobbies.length" class="space-y-4">
        <li
          v-for="lobby in lobbies"
          :key="lobby.$id"
          class="bg-slate-800 p-4 rounded shadow"
        >
          <div class="flex justify-between items-center">
            <div>
              <h2 class="text-xl font-semibold uppercase">
                {{ lobby.lobbyName || t("lobby.no_name") }}
              </h2>
              <p class="text-gray-400 text-sm">
                {{ t("lobby.lobby_code") }}: {{ lobby.code }}
              </p>
              <p class="text-gray-400 text-sm">
                {{ t("game.status") }}: {{ lobby.status }}
              </p>
              <p class="text-gray-400 text-sm">
                {{ t("game.host") }}: {{ getHostName(lobby) }}
              </p>
            </div>
            <UButton color="primary" @click="handleJoined(lobby.code)">{{
              t("game.joingame")
            }}</UButton>
          </div>
        </li>
      </ul>

      <p v-else class="text-gray-400 text-center">
        {{ t("game.nogamesavailable") }}
      </p>
      <div class="space-x-4 uppercase font-['Bebas_Neue']">
        <UButton
          size="xl"
          @click="showJoin = true"
          class="text-white text-2xl"
          variant="subtle"
          color="success"
          >{{ t("modal.join_lobby") }}</UButton
        >
        <ClientOnly>
          <UButton
            v-if="showIfAuthenticated"
            size="xl"
            @click="showCreate = true"
            class="text-white text-2xl"
            variant="subtle"
            color="warning"
            >{{ t("modal.create_lobby") }}</UButton
          >
        </ClientOnly>
      </div>

      <!-- Modals -->
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
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "~/stores/userStore";
import { useLobby } from "~/composables/useLobby";
import { useUserAccess } from "~/composables/useUserUtils";
import { getAppwrite } from "~/utils/appwrite";
import { Query } from "appwrite";
import type { Databases } from "appwrite";
import { useGetPlayerName } from "~/composables/useGetPlayerName";
import type { GameSettings } from "~/types/gamesettings";
import type { Lobby } from "~/types/lobby";
import { resolveId } from "~/utils/resolveId";
import { useI18n } from "vue-i18n";
const { t } = useI18n();

let databases: Databases | undefined;
if (import.meta.client) {
  ({ databases } = getAppwrite());
}
const config = useRuntimeConfig();
const showJoin = ref(false);
const showCreate = ref(false);
const { getPlayerName, getPlayerNameSync } = useGetPlayerName();

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
const hostNames = ref<Record<string, string>>({});

const fetchPublicLobbies = async () => {
  if (!databases) return;
  try {
    const lobbyRes = await databases.listDocuments<Lobby>(DB_ID, LOBBY_COL, [
      Query.equal("status", "waiting"),
      Query.orderDesc("$createdAt"),
      Query.limit(100),
    ]);

    const settingsRes = await databases.listDocuments<GameSettings>(
      DB_ID,
      GAMESETTINGS_COL,
      [Query.limit(1000)],
    );

    const settingsMap: Record<string, GameSettings> = {};
    for (const setting of settingsRes.documents) {
      const lobbyId = resolveId(setting.lobbyId);
      settingsMap[lobbyId] = setting;
    }

    const publicLobbies: LobbyWithName[] = [];

    for (const lobby of lobbyRes.documents) {
      const settings = settingsMap[lobby.$id];
      if (!settings || settings.isPrivate) continue;

      // Start fetching the host name in the background
      if (lobby.hostUserId) {
        getPlayerName(lobby.hostUserId).then((name) => {
          hostNames.value[lobby.hostUserId] = name;
        });
      }

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

onMounted(async () => {
  await userStore.fetchUserSession();
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
