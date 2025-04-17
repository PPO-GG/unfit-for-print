<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '~/stores/userStore';
import { useLobby } from '~/composables/useLobby';
import { usePlayers } from '~/composables/usePlayers';
import { useNotifications } from '~/composables/useNotifications';
import { useJoinLobby } from '~/composables/useJoinLobby';
import { useGameContext } from '~/composables/useGameContext';

import type { Lobby } from '~/types/lobby';
import type { Player } from '~/types/player';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const lobby = ref<Lobby | null>(null);
const players = ref<Player[]>([]);
const loading = ref(true);
const showJoinModal = ref(false);
const joinedLobby = ref(false);
const code = route.params.code as string;

const { notify } = useNotifications();
const { getLobbyByCode, leaveLobby, toPlainLobby, getActiveLobbyForUser } = useLobby();
const { getPlayersForLobby } = usePlayers();
const { initSessionIfNeeded } = useJoinLobby();
const { isPlaying, isWaiting, isComplete, isJudging } = useGameContext(lobby);

const setupRealtime = (lobbyData: Lobby) => {
  const { client } = getAppwrite();
  const config = useRuntimeConfig();

  // 🧠 Lobby Realtime
  const unsubscribeLobby = client.subscribe(
      [`databases.${config.public.appwriteDatabaseId}.collections.lobby.documents.${lobbyData.$id}`],
      async ({ events, payload }) => {
        console.log('📡 [Lobby Event]', events);

        if (events.some(e => e.endsWith('.delete'))) {
          notify({ title: 'Lobby Deleted', color: 'error', icon: 'i-mdi-alert-circle' });
          await router.replace('/join?error=deleted');
        }

        // You can also update gameState here later if needed
      }
  );

  // 👥 Player Realtime
  const unsubscribePlayers = client.subscribe(
      [`databases.${config.public.appwriteDatabaseId}.collections.players.documents`],
      async ({ events, payload }) => {
        const player = payload as Player;
        const isCreateOrUpdate = events.some(e => e.includes('create') || e.includes('update'));
        const isDelete = events.some(e => e.includes('delete'));
        const matchesLobby = player?.lobbyId === lobbyData.$id;

        if ((isCreateOrUpdate && matchesLobby) || isDelete) {
          console.log('👥 Player list changed — updating...');
          players.value = await getPlayersForLobby(lobbyData.$id);
        }
      }
  );

  // Clean up both
  onUnmounted(() => {
    console.log('🧹 Unsubscribing from realtime');
    unsubscribeLobby();
    unsubscribePlayers();
  });
};


onMounted(async () => {
  loading.value = true;

  try {
    await initSessionIfNeeded();
    await userStore.fetchUserSession();

    const user = userStore.user;
    if (!user) {
      showJoinModal.value = true;
      return;
    }

    const activeLobby = await getActiveLobbyForUser(user.$id);
    if (!activeLobby || activeLobby.code !== code) {
      showJoinModal.value = true;
      return;
    }

    const fetchedLobby = await getLobbyByCode(code);
    if (!fetchedLobby) {
      notify({ title: 'Lobby Not Found', color: 'error', icon: 'i-mdi-alert-circle' });
      return router.replace('/join?error=not_found');
    }

    joinedLobby.value = true;
    setupRealtime(fetchedLobby);

  } catch (err) {
    console.error('❌ onMounted error:', err);
    notify({ title: 'Failed to load game page', color: 'error', icon: 'i-mdi-alert-circle' });
    await router.replace('/');
  } finally {
    loading.value = false;
  }
});

const handleJoinSuccess = async (joinedCode: string) => {
  showJoinModal.value = false;
  joinedLobby.value = true;

  const fetchedLobby = await getLobbyByCode(joinedCode);
  if (!fetchedLobby) {
    notify({ title: 'Lobby Not Found', color: 'error', icon: 'i-mdi-alert-circle' });
    return;
  }
};

const handleCardSubmit = (cardId: string) => {
  console.log('🃏 submitCard:', cardId);
};

const handleWinnerSelect = (cardId: string) => {
  console.log('🏆 selectWinner:', cardId);
};

const handleLeave = async () => {
  if (!lobby.value || !userStore.user?.$id) return;
  await leaveLobby(lobby.value.$id, userStore.user.$id);
  await router.push('/');
};

const handleDrawBlackCard = () => {
  console.log('🖤 drawBlackCard');
};
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white p-4">
    <div v-if="loading">Loading game...</div>

    <!-- Show join modal if user isn't in the game -->
    <JoinLobbyForm
        v-if="showJoinModal"
        :initial-code="code"
        @joined="handleJoinSuccess"
    />

    <!-- Waiting room view -->
    <WaitingRoom
        v-else-if="isWaiting && lobby && players"
        :lobby="lobby"
        :players="players"
        @leave="handleLeave"
    />

    <!-- In-game view -->
    <GameBoard
        v-else-if="(isPlaying || isJudging) && lobby && players"
        :lobby="lobby"
        :players="players"
        :white-card-texts="{}"
        @submit-card="handleCardSubmit"
        @select-winner="handleWinnerSelect"
        @draw-black-card="handleDrawBlackCard"
        @leave="handleLeave"
    />

    <!-- Game complete -->
    <div v-else-if="isComplete">
      <h2 class="text-3xl font-bold text-center">Game Over</h2>
      <!-- Add FinalScore.vue or similar component -->
    </div>

    <!-- Catch-all fallback -->
    <div v-else>
      <p>Could not load the game state.</p>
    </div>
  </div>
</template>
