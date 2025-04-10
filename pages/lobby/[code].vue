<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from "vue";
import {useRoute, useRouter} from "vue-router";
import {useLobby} from "~/composables/useLobby";
import {useUserStore} from "~/stores/userStore";
import {useClipboard} from "@vueuse/core";
import {useNotifications} from "~/composables/useNotifications";
import type {Lobby} from '~/types/lobby';

const router = useRouter();
const route = useRoute();
const {notify} = useNotifications();
const {copy, copied} = useClipboard();
const userStore = useUserStore();

const {
  getLobbyByCode,
  getPlayersForLobby,
  setupRealtime,
  leaveLobby,
  toPlainLobby,
} = useLobby();

const lobby = ref<Lobby | null>(null);
const players = ref<any[]>([]);
const loading = ref(true);
let unsubPlayers: (() => void) | undefined;

const fetchPlayers = async (lobbyId: string) => {
  players.value = await getPlayersForLobby(lobbyId);
};

const joinUrl = computed(() =>
    lobby.value ? `${useRuntimeConfig().public.baseUrl}/join?code=${lobby.value.code}` : ""
);

onMounted(async () => {
  try {
    const code = route.params.code as string;
    const fetchedLobby = await getLobbyByCode(code);
    if (!fetchedLobby) {
      notify("Lobby not found", "error");
      await router.replace("/");
      return;
    }
    unsubPlayers = setupRealtime(
        fetchedLobby.$id,
        async () => {
          await fetchPlayers(fetchedLobby.$id);
        },
        () => {
          notify("You were kicked from the lobby", "info");
          router.replace(`/join?code=${fetchedLobby.code}&error=kicked`);
        }
    );
    lobby.value = toPlainLobby(fetchedLobby);
    await fetchPlayers(fetchedLobby.$id);
    unsubPlayers = setupRealtime(fetchedLobby.$id, async () => {
      await fetchPlayers(fetchedLobby.$id);
    });
  } catch (err) {
    console.error("Error setting up lobby:", err);
    notify("Failed to load lobby", "error");
    await router.replace("/");
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  unsubPlayers?.();
});

const handleLeave = async () => {
  try {
    const user = userStore.user;
    if (!lobby.value || !user?.$id) return;
    await leaveLobby(lobby.value.$id, user.$id);
    await router.push("/lobby?error=lobby_deleted");
  } catch (err) {
    console.error("Failed to leave lobby:", err);
    notify("Error leaving lobby", "error");
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
            @click="copy(joinUrl)"
        >
          Lobby Code: {{ lobby.code }}
        </h1>
        <span v-if="copied" class="text-green-500 text-sm animate-fade-out">
          Copied!
        </span>
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
