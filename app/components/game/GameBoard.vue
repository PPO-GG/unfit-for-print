<script lang="ts" setup>
import type { Player } from "~/types/player";
import type { Lobby } from "~/types/lobby";
import { useGameContext } from "~/composables/useGameContext";
import { useGameActions } from "~/composables/useGameActions";
import { useUserStore } from "~/stores/userStore";
import { useLobby } from "~/composables/useLobby";
import { useNotifications } from "~/composables/useNotifications";
import { useGameCards } from "~/composables/useGameCards";
import { getAppwrite } from "~/utils/appwrite";
import { Query } from "appwrite";
import BlackCardDeck from "~/components/game/BlackCardDeck.vue";
import WhiteCardDeck from "~/components/game/WhiteCardDeck.vue";
import GameTable from "~/components/game/GameTable.vue";
import GameOver from "~/components/game/GameOver.vue";
import GameHeader from "~/components/game/GameHeader.vue";
import { SFX } from "~/config/sfx.config";

const { t } = useI18n();
const props = defineProps<{ lobby: Lobby; players: Player[] }>();
const emit = defineEmits<{
  (e: "leave"): void;
}>();

const lobbyRef = ref(props.lobby);
// Keep lobbyRef in sync with props.lobby
watch(
  () => props.lobby,
  (newLobby) => {
    lobbyRef.value = newLobby;
  },
  { immediate: true },
);

// Initialize useGameCards to get player hands
const { playerHands, cardTexts, fetchGameCards, subscribeToGameCards } =
  useGameCards();

// Variable to store the unsubscribe function
let gameCardsUnsubscribe: (() => void) | null = null;

// Subscribe to game cards updates when the component is mounted
onMounted(() => {
  if (props.lobby?.$id) {
    gameCardsUnsubscribe = subscribeToGameCards(props.lobby.$id, (cards) => {
      return;
    });
  }
});

// Watch for changes to the lobby ID and re-subscribe if needed
watch(
  () => props.lobby?.$id,
  (newLobbyId, oldLobbyId) => {
    if (newLobbyId && newLobbyId !== oldLobbyId) {
      if (gameCardsUnsubscribe) {
        gameCardsUnsubscribe();
      }
      gameCardsUnsubscribe = subscribeToGameCards(newLobbyId, (cards) => {
        return;
      });
    }
  },
);

const {
  state,
  isSubmitting,
  isJudging,
  isRoundEnd,
  isComplete,
  isJudge,
  myHand,
  submissions,
  otherSubmissions,
  judgeId,
  blackCard,
  leaderboard,
  hands,
} = useGameContext(
  lobbyRef,
  computed(() => playerHands.value),
);
const { playSfx } = useSfx();
const { playCard, selectWinner, startNextRound } = useGameActions();
const { leaveLobby } = useLobby();
const userStore = useUserStore();
const myId = userStore.user?.$id ?? "";
const { notify } = useNotifications();

// Add computed properties to check player type
const currentPlayer = computed(() => {
  return props.players.find((p) => p.userId === myId);
});

const isParticipant = computed(() => {
  return (
    currentPlayer.value?.playerType === "player" ||
    !currentPlayer.value?.playerType
  );
});

const isSpectator = computed(() => {
  return currentPlayer.value?.playerType === "spectator";
});

// Check if the current user is the host
const isHost = computed(() => lobbyRef.value?.hostUserId === myId);

// Helper function to get player name from ID
const getPlayerName = (playerId: string): string => {
  const playerByUserId = props.players.find((p) => p.userId === playerId);
  if (playerByUserId?.name) return playerByUserId.name;
  const playerById = props.players.find((p) => p.$id === playerId);
  if (playerById?.name) return playerById.name;
  if (state.value?.players && state.value.players[playerId]) {
    return state.value.players[playerId];
  }
  return t("lobby.unknown_player");
};

// Track which cards have been revealed — synced via gameState
const revealedCards = computed<Record<string, boolean>>(() => {
  return state.value?.revealedCards || {};
});

function handleCardSubmit(cardIds: string[]) {
  playCard(props.lobby.$id, myId, cardIds);
}

// ── Winner Flow ─────────────────────────────────────────────────
const winnerSelected = ref(false);
const localRoundWinner = ref<string | null>(null);
// Snapshot of the winner at the moment the server confirms.
// Immune to reactive state changes during the 2-second celebration delay.
const confirmedRoundWinner = ref<string | null>(null);
let nextRoundTimeout: NodeJS.Timeout | null = null;
let hasTriggeredNextRound = false;

const effectiveRoundWinner = computed(() => {
  return localRoundWinner.value || state.value?.roundWinner || null;
});

// The active game phase for the GameTable component
// During roundEnd, keep showing as "judging" so the cards/celebration stay visible
const activePhase = computed<"submitting" | "judging">(() => {
  if (isJudging.value || isRoundEnd.value || isComplete.value) return "judging";
  return "submitting";
});

// Watch for roundWinner from the server
watch(
  () => state.value?.roundWinner,
  (newWinner) => {
    if (newWinner) {
      // Clear local optimistic winner since server confirmed
      localRoundWinner.value = null;

      // Snapshot the winner ID so the celebration overlay is immune
      // to reactive state changes during the 2-second delay.
      confirmedRoundWinner.value = newWinner;

      // Play sound effect (skip for judge — they already heard it in handleSelectWinner)
      if (!isJudge.value) {
        playSfx(SFX.selectWinner, { pitch: [0.95, 1.05], volume: 0.75 });
      }

      // Show the celebration after a brief delay to let winning card highlight
      setTimeout(() => {
        winnerSelected.value = true;

        // Play round-win fanfare when the celebration overlay appears
        playSfx(SFX.winRound, { volume: 0.25 });

        // Auto-start next round after 5 seconds
        hasTriggeredNextRound = false;
        if (nextRoundTimeout) clearTimeout(nextRoundTimeout);

        nextRoundTimeout = setTimeout(async () => {
          if (isHost.value && !hasTriggeredNextRound && !isComplete.value) {
            hasTriggeredNextRound = true;
            try {
              await startNextRound(props.lobby.$id, props.lobby.$id);
              playSfx("nextRound");
              // Refresh game cards for new round
              if (props.lobby?.$id) {
                await fetchGameCards(props.lobby.$id);
              }
            } catch (err) {
              console.error("Failed to auto-start next round:", err);
            }
          }
          // Reset for next round (skip if game is over — keep celebration visible)
          if (!isComplete.value) {
            winnerSelected.value = false;
          }
        }, 5000);
      }, 2000); // 2s delay to show winning card highlight before celebration
    }
  },
);

// Reset winner state when round changes
watch(
  () => state.value?.round,
  () => {
    winnerSelected.value = false;
    localRoundWinner.value = null;
    confirmedRoundWinner.value = null;
    hasTriggeredNextRound = false;
  },
);

function handleSelectWinner(playerId: string) {
  // First mark the winner locally for immediate feedback
  localRoundWinner.value = playerId;

  // Submit to server — this triggers the watch above for all players
  selectWinner(props.lobby.$id, playerId);

  // Play sound effect for the judge only
  playSfx(SFX.selectWinner, { pitch: [0.95, 1.05], volume: 0.75 });
}

// Reveal a card — calls server endpoint
async function revealCard(playerId: string) {
  if (revealedCards.value[playerId]) return;
  try {
    await $fetch("/api/game/reveal-card", {
      method: "POST",
      body: {
        lobbyId: props.lobby.$id,
        playerId,
      },
    });
  } catch (err) {
    console.error("Failed to reveal card:", err);
  }
}

// Clean up on unmount
onUnmounted(() => {
  if (nextRoundTimeout) clearTimeout(nextRoundTimeout);
  if (gameCardsUnsubscribe) gameCardsUnsubscribe();
});

// Add function to convert spectator to player
async function convertToPlayer(playerId: string) {
  if (!isHost.value) return;

  try {
    const playerDoc = props.players.find((p) => p.userId === playerId);
    if (!playerDoc) return;

    const { databases, tables } = getAppwrite();
    const config = useRuntimeConfig();

    await tables.updateRow({
      databaseId: config.public.appwriteDatabaseId,
      tableId: config.public.appwritePlayerCollectionId,
      rowId: playerDoc.$id,
      data: { playerType: "player" },
    });

    // Deal cards to the player
    const gameCardsRes = await tables.listRows({
      databaseId: config.public.appwriteDatabaseId,
      tableId: config.public.appwriteGamecardsCollectionId,
      queries: [Query.equal("lobbyId", props.lobby.$id)],
    });

    const gameCards = gameCardsRes.rows[0];
    if (!gameCards) return;
    const whiteDeck = gameCards.whiteDeck || [];
    const cardsPerPlayer = state.value?.config?.cardsPerPlayer || 10;
    const newHand = whiteDeck.slice(0, cardsPerPlayer);
    const remainingDeck = whiteDeck.slice(cardsPerPlayer);

    const pHands = gameCards.playerHands || [];
    const parsedHands = pHands.map((hand: string) => JSON.parse(hand));

    const existingHandIndex = parsedHands.findIndex(
      (h: any) => h.playerId === playerId,
    );
    if (existingHandIndex >= 0) {
      parsedHands[existingHandIndex].cards = newHand;
    } else {
      parsedHands.push({ playerId, cards: newHand });
    }

    await tables.updateRow({
      databaseId: config.public.appwriteDatabaseId,
      tableId: config.public.appwriteGamecardsCollectionId,
      rowId: gameCards.$id,
      data: {
        whiteDeck: remainingDeck,
        playerHands: parsedHands.map((hand: any) => JSON.stringify(hand)),
      },
    });

    notify({
      title: t("game.player_dealt_in"),
      description: t("game.player_dealt_in_description", {
        name: getPlayerName(playerId),
      }),
      color: "success",
      icon: "i-mdi-account-plus",
    });
  } catch (err) {
    notify({
      title: t("game.error_player_dealt_in"),
      color: "error",
      icon: "i-mdi-alert",
    });
  }
}

function handleLeave() {
  const nuxtApp = useNuxtApp();
  nuxtApp.payload.state.selfLeaving = true;
  leaveLobby(props.lobby.$id, myId);
  emit("leave");
}
</script>
<template>
  <div
    class="w-full bg-gradient-to-b from-slate-900 to-slate-800 min-h-screen flex flex-col"
  >
    <div
      class="fixed w-full inset-0 bg-[url('/img/textures/noise.png')] opacity-7 pointer-events-none"
    ></div>

    <!-- Main Content -->
    <div class="min-h-screen flex flex-col">
      <GameHeader
        :state="state as any"
        :is-submitting="isSubmitting"
        :is-judging="isJudging"
        :judge-id="judgeId ?? undefined"
        :players="props.players"
      />

      <main class="flex-1 p-2 md:p-6 flex flex-col overflow-hidden relative">
        <!-- Card Decks — flanking left/right, out of document flow -->
        <div class="absolute left-10 top-10 z-10">
          <BlackCardDeck :black-card="blackCard ?? undefined" />
        </div>
        <div class="absolute right-10 top-10 z-10">
          <WhiteCardDeck />
        </div>

        <!-- Unified Game Table (submission + judging + winner celebration) -->
        <GameTable
          v-if="isSubmitting || isJudging || isRoundEnd || isComplete"
          :is-judge="isJudge"
          :submissions="submissions"
          :my-id="myId"
          :black-card="blackCard"
          :my-hand="myHand"
          :is-participant="isParticipant"
          :is-spectator="isSpectator"
          :is-host="isHost"
          :players="props.players"
          :phase="activePhase"
          :revealed-cards="revealedCards"
          :effective-round-winner="effectiveRoundWinner"
          :confirmed-round-winner="confirmedRoundWinner"
          :winner-selected="winnerSelected"
          :winning-cards="state?.winningCards || []"
          :scores="state?.scores || {}"
          :judge-id="judgeId"
          :card-texts="cardTexts"
          @select-cards="handleCardSubmit"
          @convert-to-player="convertToPlayer"
          @select-winner="handleSelectWinner"
          @reveal-card="revealCard"
        />

        <!-- Waiting State -->
        <div
          v-else-if="!isComplete"
          class="text-center italic text-gray-500 mt-10"
        >
          {{ t("game.waiting") }}
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.card-deck {
  position: absolute;
  z-index: 10;
  top: 0.5rem;
}

.card-deck--black {
  left: 0.5rem;
}

.card-deck--white {
  right: 0.5rem;
}

@media (min-width: 768px) {
  .card-deck {
    top: 0.75rem;
  }

  .card-deck--black {
    left: 1rem;
  }

  .card-deck--white {
    right: 1rem;
  }
}

@media (min-width: 1280px) {
  .card-deck {
    top: 1rem;
  }

  .card-deck--black {
    left: 1.5rem;
  }

  .card-deck--white {
    right: 1.5rem;
  }
}
</style>
