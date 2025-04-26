<template>
  <div v-if="lobby">
    <h1 class="text-2xl font-bold font-['Bebas_Neue']">
      Lobby Code: {{ lobby.code }}
    <UButton
        trailing-icon="i-lucide-arrow-right"
        color="error"
        size="xl"
        @click="handleLeave"
        class="ml-4 cursor-pointer text-white"
    >
      Leave Game
    </UButton></h1>
    <PlayerList
        :players="players"
        :hostUserId="lobby.hostUserId"
        :lobbyId="lobby.$id"
        :allow-moderation="true"
    />

    <div class="mt-4">
      <div v-if="players.length >= 3">
      <UButton
          v-if="isHost"
          @click="startGameWrapper"
          icon="i-lucide-play"
      >
        Start Game
      </UButton>
        <p v-if="!isHost" class="text-gray-400 text-center font-['Bebas_Neue'] text-4xl">
          Waiting for the host to start...
        </p>
      </div>
      <div v-else>
        <p>We need at least 3 players to start the game!</p>
      </div>
    </div>
  </div>
  <div v-else>
    <p class="text-red-400 text-sm">Lobby data is unavailable.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '~/stores/userStore';
import { useLobby } from '~/composables/useLobby';
import type { Lobby } from '~/types/lobby';
import type { Player } from '~/types/player';

const props = defineProps<{
  lobby: Lobby | null;
  players: Player[];
}>();

const router = useRouter();
const userStore = useUserStore();
const { startGame, leaveLobby } = useLobby();

const isHost = computed(() =>
    props.lobby?.hostUserId === userStore.user?.$id
);

const startGameWrapper = async () => {
  if (!props.lobby) return;
  try {
    await startGame(props.lobby.$id);  // Remove hostUserId parameter
  } catch (err) {
    console.error('Failed to start game:', err);
  }
};

const handleLeave = async () => {
  if (!props.lobby || !userStore.user?.$id) return;
  try {
    await leaveLobby(props.lobby.$id, userStore.user.$id);
    await router.push('/');
  } catch (err) {
    console.error('Failed to leave lobby:', err);
  }
};
</script>

<style scoped>
</style>
