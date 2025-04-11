<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from "vue";
import {useRoute, useRouter} from "vue-router";
import {useLobby} from "~/composables/useLobby";
import {useUserStore} from "~/stores/userStore";
import {useClipboard} from "@vueuse/core";
import type {Lobby} from '~/types/lobby';
import type {Player} from '~/types/player';
import {useAppwrite} from "~/composables/useAppwrite";

const router = useRouter();
const route = useRoute();
const {copy, copied} = useClipboard();
const userStore = useUserStore();
const toast = useToast();
const config = useRuntimeConfig();

const {
  getLobbyByCode,
  getPlayersForLobby,
  setupRealtime,
  leaveLobby,
  toPlainLobby,
} = useLobby();
const {startGame: startGameFromLobby} = useLobby();

const lobby = ref<Lobby | null>(null);
const players = ref<any[]>([]);
const loading = ref(true);
const player = computed(() => {
  const user = userStore.user;
  if (!user || !lobby.value) return null;
  return players.value.find((p: Player) => p.userId === user.$id);
});

const getAppwrite = () => {
  if (import.meta.server) throw new Error("useLobby() cannot be used during SSR");
  const {databases, account, client} = useAppwrite();
  if (!databases || !account) throw new Error("Appwrite not initialized");
  return {databases, account, client};
};

const fetchPlayers = async (lobbyId: string) => {
  players.value = await getPlayersForLobby(lobbyId);
};

const joinUrl = computed(() =>
    lobby.value ? `${useRuntimeConfig().public.baseUrl}/join?code=${lobby.value.code}` : ""
);

let unsubPlayers: (() => void) | undefined;
let unsubLobby: (() => void) | undefined;

onMounted(async () => {
  try {
    const { client } = getAppwrite();
    const code = route.params.code as string;
    const fetchedLobby = await getLobbyByCode(code);
    if (!fetchedLobby) {
      await router.replace("/");
      return;
    }

    // ✅ Redirect if game already started
    if (fetchedLobby.status === 'playing') {
      return router.replace(`/game/${fetchedLobby.code}`);
    }

    lobby.value = toPlainLobby(fetchedLobby);
    await fetchPlayers(fetchedLobby.$id);

    unsubPlayers = setupRealtime(
        fetchedLobby.$id,
        async () => {
          await fetchPlayers(fetchedLobby.$id);
        },
        () => {
          router.replace(`/join?code=${fetchedLobby.code}&error=kicked`);
        }
    );

    // ✅ Add this to detect lobby status change → game started
    unsubLobby = client.subscribe(
        [`databases.${config.public.appwriteDatabaseId}.collections.lobby.documents.${fetchedLobby.$id}`],
        async (response: { payload: Lobby; events: string[] }) => {
          const {payload, events} = response;

          if (
              events.some((e) => e.includes('update')) &&
              payload.status === 'playing'
          ) {
            await router.replace(`/game/${payload.code}`);
          }
        }
    );
  } catch (err) {
    console.error("Error setting up lobby:", err);
    await router.replace("/");
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  unsubPlayers?.();
  unsubLobby?.();
});

const handleLeave = async () => {
  try {
    const user = userStore.user;
    if (!lobby.value || !user?.$id) return;
    await leaveLobby(lobby.value.$id, user.$id);
    await router.push("/lobby?error=lobby_deleted");
  } catch (err) {
    console.error("Failed to leave lobby:", err);
    // notify("Error leaving lobby", "error");
  }
};

const startGame = async () => {
  const players = await getPlayersForLobby(lobby.value!.$id);
  if (!lobby.value || !userStore.user?.$id || players.length < 3) {
    toast.add({
      title: "Couldn't Start Game",
      description: 'You need at least 2 players to start the game.',
      color: "error"
    });
    return;
  }

  await startGameFromLobby(lobby.value.$id, userStore.user.$id);
  await router.push(`/game/${lobby.value.code}`);
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
            @click="copy(joinUrl)"
        >
          Lobby Code: {{ lobby.code }}
        </h1>
        <span v-if="copied" class="text-green-500 text-sm animate-fade-out">
          Copied!
        </span>
        <UButton
            v-if="player.isHost && lobby.status === 'waiting'"
            label="Start Game"
            icon="i-lucide-gamepad"
            class="mt-6"
            :disabled="players.length < 3"
            @click="startGame"
        />
        <h1 v-if="players.length < 3" class="font-[Bebas_Neue] text-xl font-bold text-red-600">You need at least 3
          players to start the game</h1>
      </div>
      <button
          @click="handleLeave"
          class="text-white hover:text-red-400 bg-red-900 rounded-lg p-2 mt-4"
      >
        Leave Lobby
      </button>
      <p class="mt-2">Status: {{ lobby.status }}</p>
      <PlayerList
          :players="players"
          :hostUserId="lobby.hostUserId"
          :lobbyId="lobby.$id"
      />
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
