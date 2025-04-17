<script setup lang="ts">
import {onMounted, onUnmounted, ref} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {useUserStore} from '~/stores/userStore';
import {useLobby} from '~/composables/useLobby';
import {usePlayers} from '~/composables/usePlayers';
import {useNotifications} from '~/composables/useNotifications';
import {useJoinLobby} from '~/composables/useJoinLobby';
import {useGameContext} from '~/composables/useGameContext';

import type {Lobby} from '~/types/lobby';
import type {Player} from '~/types/player';

const selfLeaving = ref(false);
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const lobby = ref<Lobby | null>(null);
const players = ref<Player[]>([]);
const loading = ref(true);
const showJoinModal = ref(false);
const joinedLobby = ref(false);
const code = route.params.code as string;

const {notify} = useNotifications();
const {getLobbyByCode, leaveLobby, toPlainLobby, getActiveLobbyForUser} = useLobby();
const {getPlayersForLobby} = usePlayers();
const {initSessionIfNeeded} = useJoinLobby();
const {isPlaying, isWaiting, isComplete, isJudging} = useGameContext(lobby);

const setupRealtime = async (lobbyData: Lobby) => {
  const {client} = getAppwrite();
  const config = useRuntimeConfig();
  const lobbyId = lobbyData.$id;
  // initial fetch
  players.value = await getPlayersForLobby(lobbyId);

  // 🧠 Lobby Realtime
  const unsubscribeLobby = client.subscribe(
      [`databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwriteLobbyCollectionId}.documents.${lobbyData.$id}`],
      async ({events, payload}) => {
        console.log('📡 [Lobby Event]', events);

        if (events.some(e => e.endsWith('.delete'))) {
          notify({title: 'Lobby Deleted', color: 'error', icon: 'i-mdi-alert-circle'});
          await router.replace('/join?error=deleted');
        }

        // You can also update gameState here later if needed
      }
  );

  // 👥 Player Realtime
  const playersTopic = `databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwritePlayerCollectionId}.documents`;

  const unsubscribePlayers = client.subscribe(
      [playersTopic],
      async ({events, payload}) => {
        // 1️⃣ If it’s a delete event for *your* player doc, redirect immediately
        const isDelete = events.some(e => e.endsWith('.delete'));
        if (isDelete && (payload as Player).userId === userStore.user!.$id) {
          if (selfLeaving.value) {
            // you clicked Leave
            notify({
              title:  'You left the lobby',
              color:  'info',
              icon:   'i-mdi-exit-run',
            });
          } else {
            // someone else kicked you
            notify({
              title:  'You were kicked from the lobby',
              color:  'error',
              icon:   'i-mdi-account-remove',
            });
          }

          // reset the flag so future deletes act normally
          selfLeaving.value = false;

          return router.replace('/');
        }

        // 2️⃣ Otherwise, if it’s for *this* lobby, re‑fetch the list
        const player = payload as Player;
        if (player.lobbyId === lobbyId) {
          console.log('👥 player event:', events, player);
          players.value = await getPlayersForLobby(lobbyId);
        }
      }
  );

  // Clean up both
  onUnmounted(() => {
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
      notify({title: 'Lobby Not Found', color: 'error', icon: 'i-mdi-alert-circle'});
      return router.replace('/join?error=not_found');
    }
    lobby.value = fetchedLobby;
    joinedLobby.value = true;
    await setupRealtime(fetchedLobby);

  } catch (err) {
    console.error('❌ onMounted error:', err);
    notify({title: 'Failed to load game page', color: 'error', icon: 'i-mdi-alert-circle'});
    await router.replace('/');
  } finally {
    loading.value = false;
  }
});

const handleJoinSuccess = async (joinedCode: string) => {

  const fetchedLobby = await getLobbyByCode(joinedCode);
  if (!fetchedLobby) {
    notify({title: 'Lobby Not Found', color: 'error', icon: 'i-mdi-alert-circle'});
    return;
  }
  lobby.value = fetchedLobby;
  await setupRealtime(fetchedLobby);
  showJoinModal.value = false;
  joinedLobby.value = true;
};

const handleCardSubmit = (cardId: string) => {
  console.log('🃏 submitCard:', cardId);
};

const handleWinnerSelect = (cardId: string) => {
  console.log('🏆 selectWinner:', cardId);
};

const handleLeave = async () => {
  if (!lobby.value || !userStore.user?.$id) return;

  // mark that *we* are leaving
  selfLeaving.value = true;

  // perform the leave (i.e. delete our player doc)
  await leaveLobby(lobby.value.$id, userStore.user.$id);

  // navigate away
  return router.replace('/');
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
