<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '~/stores/userStore';
import { useLobby } from '~/composables/useLobby';
import { usePlayers } from '~/composables/usePlayers';
import { useGameRealtime } from '~/composables/useGameRealtime';
import { useSubmittedCards } from '~/composables/useSubmittedCards';
import { useNotifications } from '~/composables/useNotifications';
import { useJoinLobby } from '~/composables/useJoinLobby'
import { useUserAccess } from '~/composables/useUserUtils'
import { useGameContext } from '~/composables/useGameContext'

import type { Lobby } from '~/types/lobby';
import type { Player } from '~/types/player';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const code = route.params.code as string;
const lobby = ref<Lobby | null>(null);
const loading = ref(true);
const players = ref<Player[] | null>([]);
const lobbyCode = route.params.code as string
const showJoinModal = ref(false)
const joinedLobby = ref(false)

const { notify } = useNotifications();
const { getLobbyByCode, leaveLobby, toPlainLobby, fetchPlayers } = useLobby();
const { getPlayersForLobby } = usePlayers();
const { showIfAnonymous } = useUserAccess()
const { getActiveLobbyForUser } = useLobby()
const { initSessionIfNeeded } = useJoinLobby()
const { loadSubmittedCards } = useSubmittedCards(code);
const { isPlaying, isWaiting, isComplete, isJudging } = useGameContext(lobby)

onMounted(async () => {
  await initSessionIfNeeded()

  const user = userStore.user
  if (!user) {
    showJoinModal.value = true
    return
  }

  const activeLobby = await getActiveLobbyForUser(user.$id)
  if (!activeLobby || activeLobby.code !== lobbyCode) {
    showJoinModal.value = true
    return
  }

  joinedLobby.value = true

  try {
    await userStore.fetchUserSession()
    const fetchedLobby = await getLobbyByCode(code)
    if (!fetchedLobby) return router.replace('/join?error=not_found')

    lobby.value = toPlainLobby(fetchedLobby)
    players.value = await getPlayersForLobby(fetchedLobby.$id)

    useGameRealtime({
      lobby: lobby.value!,
      onPlayersUpdated: async () => {
        console.log('📡 Player list update triggered')
        const updated = await getPlayersForLobby(lobby.value!.$id)
        console.log('👥 Updated players:', updated)
        players.value = updated
      },
      onPhaseChange: (phase) => {
        console.log('Phase changed:', phase)
      },
      onLobbyDeleted: () => {
        notify({
          title: "Lobby Deleted",
          color: "error",
          icon: "i-mdi-alert-circle",
          duration: 5000,
        })
        router.replace('/join?error=deleted')
      }
    })
  } catch (err) {
    notify({
      title: "Failed to load game page",
      color: "error",
      icon: "i-mdi-alert-circle",
      duration: 5000,
    })
    await router.replace('/')
  } finally {
    loading.value = false
  }
})

const handleJoinSuccess = async (code: string) => {
  showJoinModal.value = false
  joinedLobby.value = true

  const fetchedLobby = await getLobbyByCode(code)
  if (!fetchedLobby) {
    notify({
      title: 'Lobby Not Found',
      color: 'error',
      icon: 'i-mdi-alert-circle',
      duration: 5000
    })
    return
  }

  lobby.value = toPlainLobby(fetchedLobby)
  players.value = await getPlayersForLobby(fetchedLobby.$id)

  useGameRealtime({
    lobby: lobby.value!,
    onPlayersUpdated: async () => {
      players.value = await getPlayersForLobby(lobby.value!.$id)
    },
    onPhaseChange: (phase) => {
      console.log('Phase changed:', phase)
    },
    onLobbyDeleted: () => {
      notify({ title: 'Lobby Deleted', color: 'error' })
      router.replace('/join?error=deleted')
    }
  })
}

const handleCardSubmit = (cardId: string) => {
  // Placeholder — call submitCard function
  console.log('submitCard', cardId);
};

const handleWinnerSelect = (cardId: string) => {
  // Placeholder — call selectWinner function
  console.log('selectWinner', cardId);
};

const handleLeave = async () => {
  if (!lobby.value || !userStore.user?.$id) return;
  await leaveLobby(lobby.value.$id, userStore.user.$id);
  await router.push('/');
};

const handleDrawBlackCard = () => {
  // Placeholder — used when judge clicks stack
  console.log('drawBlackCard');
};
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white p-4">
    <div v-if="loading">Loading game...</div>
    <JoinLobbyForm
        v-if="showJoinModal"
        :initial-code="lobbyCode"
        @joined="handleJoinSuccess"
    />
    <WaitingRoom
        v-else-if="isWaiting"
        :lobby="lobby"
        :players="players"
        @leave="handleLeave"
    />
    <GameBoard
        v-else-if="isPlaying || isJudging"
        :lobby="lobby"
        :players="players"
        :white-card-texts="{}"
        @submit-card="handleCardSubmit"
        @select-winner="handleWinnerSelect"
        @draw-black-card="handleDrawBlackCard"
    @leave="handleLeave"
    />
    <div v-else-if="isComplete" class="text-center">
      <h2 class="text-3xl font-bold">Game Over</h2>
      <!-- Add FinalScore.vue later -->
    </div>
    <p v-else>Could not load the game state.</p>
  </div>
</template>
