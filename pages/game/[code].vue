<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLobby } from '~/composables/useLobby';
import { useGame } from '~/composables/useGame';
import { useUserStore } from '~/stores/userStore';
import { useNotifications } from '~/composables/useNotifications';
import { useAppwrite } from '~/composables/useAppwrite';
import type { Lobby } from '~/types/lobby';
import type { Player } from '~/types/player';
import { getAppwrite } from '~/utils/appwrite';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const { getLobbyByCode, toPlainLobby, getPlayersForLobby } = useLobby();
const { notify } = useNotifications();
const { databases } = useAppwrite();
const config = useRuntimeConfig();

const code = route.params.code as string;
const lobby = ref<Lobby | null>(null);
const players = ref<Player[]>([]);
const loading = ref(true);
const whiteCardTexts = ref<Record<string, string>>({});

const {
  gameState,
  isJudge,
  isPlaying,
  getHand,
  getScore,
  getPlayedCard,
  hasSubmittedCard,
  canRevealWinner,
  getRemainingPlayers
} = useGame(lobby);

const fetchPlayers = async (lobbyId: string) => {
  const rawPlayers = await getPlayersForLobby(lobbyId);
  players.value = rawPlayers.map((doc) => ({
    $id: doc.$id,
    userId: doc.userId,
    lobbyId: doc.lobbyId,
    name: doc.name,
    avatar: doc.avatar,
    isHost: doc.isHost,
    joinedAt: doc.joinedAt,
    provider: doc.provider,
  }));
};

const preloadWhiteCards = async (cardIds: string[]) => {
  if (!databases) return;
  const promises = cardIds.map((id) =>
      databases.getDocument(config.public.appwriteDatabaseId, config.public.appwriteWhiteCardCollectionId, id)
  );
  const results = await Promise.all(promises);
  for (const card of results) {
    whiteCardTexts.value[card.$id] = card.text;
  }
};

const handleCardSubmit = async (cardId: string) => {
  if (!lobby.value || !userStore.user?.$id || hasSubmittedCard.value) return;

  try {
    const { databases } = getAppwrite();
    const currentState = JSON.parse(lobby.value.gameState);
    currentState.playedCards[userStore.user.$id] = cardId;

    await databases.updateDocument(
        config.public.appwriteDatabaseId,
        config.public.appwriteLobbyCollectionId,
        lobby.value.$id,
        {
          gameState: JSON.stringify(currentState),
        }
    );
  } catch (err) {
    console.error("Failed to submit card:", err);
    notify("Failed to submit card", "error");
  }
};

onMounted(async () => {
  try {
    await userStore.fetchUserSession();
    const fetchedLobby = await getLobbyByCode(code);

    if (!fetchedLobby) {
      notify("Lobby not found", "error");
      return router.replace("/join?error=not_found");
    }

    if (fetchedLobby.status !== 'playing') {
      notify("This game hasn't started yet", "info");
      return router.replace(`/lobby/${code}`);
    }

    lobby.value = toPlainLobby(fetchedLobby);
    await fetchPlayers(fetchedLobby.$id);

    const hand = getHand.value;
    if (hand.length) await preloadWhiteCards(hand);
  } catch (err) {
    notify("Failed to load game", "error");
    console.error("Game load error:", err);
    await router.replace('/');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white p-6">
    <div v-if="loading">Loading game...</div>
    <div v-else-if="!lobby">Game not found.</div>
    <div v-else>
      <h1 class="text-3xl font-bold mb-4">Unfit For Print</h1>
      <p class="mb-2">Game Code: {{ code }}</p>
      <p class="mb-4">Round {{ gameState?.round }} | Phase: {{ gameState?.phase }}</p>
      <PlayerList
          :players="players"
          :hostUserId="lobby.hostUserId"
          :lobbyId="lobby.$id"
      />
      <div v-if="gameState?.blackCard" class="mb-6">
        <BlackCard
            :text="gameState.blackCard.text"
            :card-pack="gameState.blackCard.pack || 'core'"
            :back-logo-url="'/img/unfit_logo_alt_dark.png'"
            :mask-url="'/img/textures/hexa2.png'"
        />
      </div>

      <div v-if="isJudge">
        <p class="text-xl font-semibold">You are the Judge 👑</p>
      </div>

      <div v-else-if="isPlaying">
        <p class="text-xl font-semibold mb-2">Choose a card to play:</p>
        <div class="flex flex-wrap gap-4">
          <WhiteCard
              v-for="cardId in getHand"
              :key="cardId"
              :card-id="cardId"
              :text="whiteCardTexts[cardId]"
              :card-pack="'core'"
              :back-logo-url="'/img/unfit_logo_alt_dark.png'"
              :mask-url="'/img/textures/hexa2.png'"
              :disabled="hasSubmittedCard"
              @click="() => handleCardSubmit(cardId)"
          />
        </div>
      </div>

      <div v-if="canRevealWinner">
        <p class="mt-6 text-green-400">Ready to pick a winner!</p>
        <!-- Reveal winner button logic can go here -->
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
