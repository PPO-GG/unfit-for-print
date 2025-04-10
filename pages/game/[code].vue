<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLobby } from '~/composables/useLobby';
import { useUserStore } from '~/stores/userStore';
import { useNotifications } from '~/composables/useNotifications';
import type { Lobby } from '~/types/lobby';
import type {Player} from "~/types/player";
import {useClipboard} from "@vueuse/core";

const {
  getLobbyByCode,
  toPlainLobby,
  getPlayersForLobby,
  leaveLobby,
} = useLobby();
const notify = useNotifications();
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const {copy, copied} = useClipboard();
const code = route.params.code as string;
const lobby = ref<Lobby | null>(null);
const loading = ref(true);
const players = ref<any[]>([]);
const player = computed(() => {
  const user = userStore.user;
  if (!user || !lobby.value) return null;
  return players.value.find((p: Player) => p.userId === user.$id);
});

const fetchPlayers = async (lobbyId: string) => {
  players.value = await getPlayersForLobby(lobbyId);
};

onMounted(async () => {
  try {
    await userStore.fetchUserSession();
    const fetchedLobby = await getLobbyByCode(code);

    if (!fetchedLobby) {
      // notify("Lobby not found", "error");
      return router.replace("/join?error=not_found");
    }

    if (fetchedLobby.status !== 'playing') {
      // notify("This game hasn't started yet", "info");
      return router.replace(`/lobby/${code}`);
    }

    lobby.value = toPlainLobby(fetchedLobby);
    players.value = await getPlayersForLobby(fetchedLobby.$id);
  } catch (err) {
    // notify("Failed to load game", "error");
    console.error("Game load error:", err);
    await router.replace('/');
  } finally {
    loading.value = false;
  }
});

const gameState = computed(() => {
  try {
    return lobby.value ? JSON.parse(lobby.value.gameState) : null;
  } catch (e) {
    return null;
  }
});

const joinUrl = computed(() =>
    lobby.value ? `${useRuntimeConfig().public.baseUrl}/join?code=${lobby.value.code}` : ""
);

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
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white p-6">
    <div v-if="loading">Loading game...</div>
    <div v-else-if="!lobby">Game not found.</div>
    <div v-else>
      <UButton
          class="text-3xl font-bold cursor-pointer hover:text-slate-300"
          @click="copy(joinUrl)"
      >
        Lobby Code: {{ lobby.code }}
      </UButton>
      <span v-if="copied" class="text-green-500 text-sm animate-fade-out">
          Copied!
        </span>
      <button
          @click="handleLeave"
          class="text-white hover:text-red-400 bg-red-900 rounded-lg p-2 mt-4"
      >
        Leave Lobby
      </button>
      <PlayerList
          v-if="players.length"
          :players="players"
          :hostUserId="lobby.hostUserId"
          :lobbyId="lobby.$id"
      />
      <p class="mb-2">Game Code: {{ code }}</p>
      <p class="mb-4">Round {{ gameState?.round }} | Phase: {{ gameState?.phase }}</p>

      <pre class="bg-slate-800 p-4 rounded text-sm">
        {{ gameState }}
      </pre>
    </div>
  </div>
</template>

<style scoped>
</style>
