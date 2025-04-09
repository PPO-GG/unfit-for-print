<script lang="ts" setup>
import { useLobby } from "~/composables/useLobby";
import type { Lobby } from "~/types/lobby";
import { useRouter, useRoute } from "vue-router";
import { Query } from "appwrite";
import { usePlayers } from "~/composables/usePlayers";
import { useUserStore } from "~/stores/userStore";
import { useClipboard } from "@vueuse/core";
import { onMounted, onUnmounted } from "vue";
import { useAppwrite } from "~/composables/useAppwrite";
import { useNotifications } from "~/composables/useNotifications";

const config = useRuntimeConfig();
const { notify } = useNotifications();
const { copy, copied } = useClipboard();
const userStore = useUserStore();
const route = useRoute();
const router = useRouter();
const { getLobbyByCode, leaveLobby } = useLobby();
const lobby = ref<Lobby | null>(null);
const loading = ref(true);
const players = ref<any[]>([]);
const { client, databases, account } = useAppwrite();
const { getPlayersForLobby } = usePlayers();

let unsubscribe: (() => void) | null = null;

const fetchPlayers = async (lobbyId: string) => {
  players.value = await getPlayersForLobby(lobbyId);
};

onBeforeRouteLeave((to, from) => {
  loading.value = true;
  return true;
});

onMounted(async () => {
  try {
    const code = route.params.code as string;
    const fetchedLobby = await getLobbyByCode(code);
    if (!fetchedLobby) {
      notify("Lobby not found", "error");
      router.replace("/");
      return; // Return after the router.replace()
    }

    // Set the lobby ref
    lobby.value = fetchedLobby;

    // Set up realtime updates
    unsubscribe = client.subscribe(
      [
        `databases.${config.public.appwriteDatabaseId}.collections.lobby.documents.${fetchedLobby.$id}`,
      ],
      (response) => {
        if (
          response.events.includes(
            "databases.*.collections.lobby.documents.*.delete"
          )
        ) {
          notify("Lobby was deleted", "info", { icon: "🚪" });
          router.replace("/");
        }
      }
    );

    // Fetch initial players
    await fetchPlayers(fetchedLobby.$id);

    // Set up realtime player updates
    setupRealtime(fetchedLobby.$id);
  } catch (err) {
    console.error("Error setting up lobby:", err);
    notify("Failed to load lobby", "error");
    router.replace("/");
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});

const setupRealtime = (lobbyId: string) => {
  unsubscribe = client.subscribe(
    `databases.${config.public.appwriteDatabaseId}.collections.players.documents`,
    async (response) => {
      const { payload, events } = response as {
        payload: any;
        events: string[];
      };

      if (
        events.some((e) => e.includes("create")) &&
        payload.lobbyId === lobbyId
      ) {
        await fetchPlayers(lobbyId);
      }

      if (
        events.some((e) => e.includes("delete")) &&
        payload.lobbyId === lobbyId
      ) {
        await fetchPlayers(lobbyId);
      }

      if (
        events.some((e) => e.includes("update")) &&
        payload.lobbyId === lobbyId
      ) {
        await fetchPlayers(lobbyId);
      }
    }
  );
};

const handleLeave = async () => {
  try {
    const user = userStore.user || (await account.get());
    if (!lobby.value || !user?.$id) return;

    await leaveLobby(lobby.value.$id, user.$id);

    router.push("/lobby?error=lobby_deleted");
  } catch (err) {
    console.error("Failed to leave lobby:", err);
  }
};
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white p-6">
    <div v-if="loading">Loading lobby...</div>
    <div v-else-if="!lobby">Lobby not found.</div>
    <div v-else>
      <div class="flex items-center gap-2">
        <h1
          class="text-3xl font-bold cursor-pointer hover:text-slate-300"
          @click="copy(config.public.baseUrl+'/join?code='+lobby.code)"
        >
          Lobby Code: {{ lobby.code }}
        </h1>
        <span v-if="copied" class="text-green-500 text-sm animate-fade-out">
          Copied!
        </span>
      </div>
      <button
        @click="handleLeave"
        class="text-white hover:text-red-400 bg-red-900 rounded-lg p-2"
      >
        Leave Lobby
      </button>
      <p>Status: {{ lobby.status }}</p>
      <PlayerList :players="players" :hostUserId="lobby.hostUserId" />
    </div>
  </div>
</template>
<style scoped>
.animate-fade-out {
  animation: fadeOut 3s forwards;
}

@keyframes fadeOut {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>
