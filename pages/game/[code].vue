<script setup lang="ts">
import {onMounted, onUnmounted, ref} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {useUserStore} from '~/stores/userStore';
import {useLobby} from '~/composables/useLobby';
import {usePlayers} from '~/composables/usePlayers';
import {useNotifications} from '~/composables/useNotifications';
import {useJoinLobby} from '~/composables/useJoinLobby';
import {useGameContext} from '~/composables/useGameContext';
import {isAuthenticatedUser} from '~/composables/useUserUtils';
import RoundEndOverlay from '~/components/game/RoundEndOverlay.vue'; // Import the new component
import type {Lobby} from '~/types/lobby';
import type {Player} from '~/types/player';


definePageMeta({
	layout: 'game'
})

const route = useRoute()
const code = route.params.code as string

const { data: lobbyCode } = await useAsyncData(`lobby-${code}`, () =>
    $fetch(`/api/lobby/${code}`)
)

useHead({
  title: `Unfit for Print | Game ${code}`,
  meta: [
    { name: 'description', content: 'Join the chaos in Unfit for Print – a Cards Against Humanity-inspired party game!' },
    { property: 'og:title', content: `Unfit for Print - Game ${code}` },
    { property: 'og:description', content: 'A hilarious and chaotic web game. Join this lobby and play with friends!' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: `https://ufp.ppo.gg/game/${code}` },
    { property: 'og:image', content: `https://ufp.ppo.gg/api/og?code=${code}` },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: `Unfit for Print - Game ${code}` },
    { name: 'twitter:description', content: 'Join this absurd card game and see who has the worst sense of humor.' },
    { name: 'twitter:image', content: `https://ufp.ppo.gg/api/og?code=${code}` },
  ],
})

const selfLeaving = ref(false);
const router = useRouter();
const userStore = useUserStore();
const lobby = ref<Lobby | null>(null);
const players = ref<Player[]>([]);
const loading = ref(true);
const showJoinModal = ref(false);
const joinedLobby = ref(false);

const {notify} = useNotifications();
const {getLobbyByCode, leaveLobby, toPlainLobby, getActiveLobbyForUser, resetGameState} = useLobby();
const {getPlayersForLobby, getUserAvatarUrl} = usePlayers();
const {initSessionIfNeeded} = useJoinLobby();
const {
  isPlaying, isWaiting, isComplete, isJudging, leaderboard, // Existing
  isRoundEnd, roundWinner, roundEndStartTime, roundEndCountdownDuration, // New context properties
  myId // Need myId for isWinnerSelf and isHost checks
} = useGameContext(lobby);

const setupRealtime = async (lobbyData: Lobby) => {
  console.log('🔌 Setting up realtime for lobby:', lobbyData.$id);
  const {client} = getAppwrite();
  const config = useRuntimeConfig();
  const lobbyId = lobbyData.$id;
  // initial fetch
  players.value = await getPlayersForLobby(lobbyId);
  console.log('🔌 Initial players:', players.value);

  // 🧠 Lobby Realtime
  const unsubscribeLobby = client.subscribe(
      [`databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwriteLobbyCollectionId}.documents.${lobbyData.$id}`],
      async ({events, payload}) => {
        console.log('📡 [Lobby Event]', events, payload);

        if (events.some(e => e.endsWith('.delete'))) {
          notify({title: 'Lobby Deleted', color: 'error', icon: 'i-mdi-alert-circle'});
          await router.replace('/join?error=deleted');
        }

        // Update lobby data when it changes
        if (events.some(e => e.endsWith('.update'))) {
          // Create a new lobby object to trigger reactivity
          lobby.value = { ...payload as Lobby };
          console.log('📡 [Lobby Updated]', lobby.value);
        }
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

    // Check if user is the creator of the lobby (from URL query param)
    // Only allow authenticated users to use the creator parameter
    const isCreator = route.query.creator === 'true' && isAuthenticatedUser(user);

    // Check if the user is already in an active lobby, regardless of whether they're anonymous or authenticated
    if (!isCreator) {
      const activeLobby = await getActiveLobbyForUser(user.$id);
      if (activeLobby && activeLobby.code === code) {
        // User is already in this lobby, proceed without showing join modal
      } else if (activeLobby) {
        // User is in a different active lobby, redirect them there
        notify({title: 'Redirecting to your active game', color: 'info', icon: 'i-mdi-controller'});
        return router.replace(`/game/${activeLobby.code}`);
      } else {
        // User is not in any active lobby, show join modal
        showJoinModal.value = true;
        return;
      }
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

  // Call the leaveLobby function to handle player document deletion
  // and update game state if needed
  await leaveLobby(lobby.value.$id, userStore.user.$id);

  // navigate away
  return router.replace('/');
};

const handleDrawBlackCard = () => {
  console.log('🖤 drawBlackCard');
};

const getPlayerName = (playerId: string | null): string | null => { // Allow null playerId
  if (!playerId) return null;
  const player = players.value.find(p => p.userId === playerId);
  return player?.name || 'Unknown Player'; // Keep fallback for safety
};

const handleContinue = async () => {
  if (!lobby.value) return;

  try {
    // Reset the game state to return to the waiting room
    await resetGameState(lobby.value.$id);
    notify({
      title: 'Returned to lobby',
      color: 'success',
      icon: 'i-mdi-check-circle'
    });
  } catch (err) {
    console.error('Failed to return to lobby:', err);
    notify({
      title: 'Failed to return to lobby',
      color: 'error',
      icon: 'i-mdi-alert-circle'
    });
  }
};
</script>

<template>
  <div class="bg-slate-900 text-white">
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
        v-else-if="(isPlaying || isJudging || isRoundEnd) && lobby && players"
        :lobby="lobby"
        :players="players"
        :white-card-texts="{}"
        @submit-card="handleCardSubmit"
        @select-winner="handleWinnerSelect"
        @draw-black-card="handleDrawBlackCard"
        @leave="handleLeave"
    />

    <!-- Game complete -->
    <div v-else-if="isComplete && lobby && players" class="max-w-4xl mx-auto py-8 px-4">
      <h2 class="text-3xl font-bold text-center mb-6">Game Over</h2>

      <!-- Winner display -->
      <div class="bg-slate-800 rounded-lg p-6 mb-8 text-center">
        <h3 class="text-2xl font-bold mb-4">Winner</h3>
        <div v-if="leaderboard.length > 0" class="flex flex-col items-center">
          <div class="text-yellow-400 text-5xl mb-2">🏆</div>
          <div class="text-2xl font-bold text-yellow-400">
            {{ getPlayerName(leaderboard[0].playerId) }}
          </div>
          <div class="text-xl mt-2">
            {{ leaderboard[0].points }} points
          </div>
        </div>
      </div>

      <!-- Leaderboard -->
      <div class="bg-slate-800 rounded-lg p-6 mb-8">
        <h3 class="text-xl font-bold mb-4 text-center">Final Scores</h3>
        <div class="space-y-2">
          <div v-for="(entry, index) in leaderboard" :key="entry.playerId" 
               class="flex justify-between items-center p-2 rounded"
               :class="index === 0 ? 'bg-yellow-900/30' : 'bg-slate-700/50'">
            <div class="flex items-center">
              <span class="w-8 text-center">{{ index + 1 }}</span>
              <span>{{ getPlayerName(entry.playerId) }}</span>
            </div>
            <span class="font-bold">{{ entry.points }} pts</span>
          </div>
        </div>
      </div>

      <!-- Continue button -->
      <div class="text-center mt-8">
        <UButton
          @click="handleContinue"
          icon="i-lucide-arrow-right"
          color="primary"
          size="lg"
        >
          Continue to Lobby
        </UButton>
      </div>
    </div>

    <!-- Round End Overlay -->
    <RoundEndOverlay
        v-if="isRoundEnd && lobby"
        :lobby-id="lobby.$id"
        :winner-name="getPlayerName(roundWinner)"
        :is-winner-self="roundWinner === myId"
        :countdown-duration="roundEndCountdownDuration"
        :start-time="roundEndStartTime"
        :is-host="lobby.hostUserId === myId"
    />

    <!-- Catch-all fallback -->
    <div v-else-if="!lobby"> <!-- Only show fallback if lobby truly failed to load -->
      <p>Could not load the game state.</p>
    </div>
  </div>
</template>
