// GameBoard.vue
<template>
  <div class="p-4">
    <div class="flex justify-between items-center mb-4">
      <div class="flex items-center">
        <div class="round-indicator mr-3">
          <span class="round-number">{{ state?.round || 1 }}</span>
        </div>
        <h2 class="text-xl font-bold">Round {{ state?.round || 1 }}</h2>
      </div>
      <button 
        class="leave-button"
        @click="handleLeave"
      >
        Leave Game
      </button>
    </div>

    <!-- Enhanced Player List -->
    <PlayerList
      :players="props.players"
      :host-user-id="props.lobby.hostUserId"
      :lobby-id="props.lobby.$id"
      :czar-id="czarId"
      :submissions="submissions"
      :game-phase="state?.phase"
      :scores="state?.scores"
    />

    <!-- Submission Phase -->
    <div v-if="isSubmitting && blackCard">
      <div class="flex justify-center mb-4">
        <BlackCardComponent 
          :text="blackCard.text" 
          :num-pick="blackCard.pick"
          :card-id="blackCard.id"
          :flipped="false"
          :three-deffect="true"
        />
      </div>

      <!-- Show message for the Judge -->
      <div v-if="isCzar" class="text-center p-4">
        <p class="text-xl font-bold">You are the Judge for this round!</p>
        <p class="mt-2">Wait for other players to submit their cards.</p>

        <!-- Show submitted cards for the Judge -->
        <div v-if="Object.keys(submissions).length > 0" class="mt-4">
          <p class="font-semibold mb-2">Submitted cards ({{ Object.keys(submissions).length }} / {{ Object.keys(hands).filter(id => id !== czarId).length }})</p>
          <div class="grid grid-cols-4 gap-2">
            <div 
              v-for="(_, playerId) in submissions" 
              :key="playerId" 
              class="card submission p-4"
            >
              <p class="font-medium">{{ getPlayerName(playerId) }}</p>
              <p class="text-sm opacity-70">has submitted</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Show submitted cards for non-Judges -->
      <div v-else-if="submissions[myId]" class="text-center p-4 mb-4">
        <p class="font-semibold">You've submitted your cards:</p>
        <div class="flex justify-center mt-2 gap-2">
          <whiteCard 
            v-for="cardId in submissions[myId]" 
            :key="cardId" 
            :cardId="cardId"
          />
        </div>
        <p class="mt-4 italic">Waiting for other players to submit their cards...</p>
      </div>

      <!-- User's hand will be displayed at the bottom of the screen (only for non-Judges who haven't submitted) -->
      <UserHand 
        v-else
        :cards="myHand" 
        :disabled="!!submissions[myId]"
        :cards-to-select="blackCard.pick"
        @select-cards="handleCardSubmit"
      />
    </div>
    <div v-else-if="isSubmitting && !blackCard" class="text-center p-4">
      <p class="text-xl font-bold">Waiting for black card to be drawn...</p>
    </div>

    <!-- Judging Phase -->
    <div v-else-if="isJudging && blackCard">
      <div class="flex justify-center mb-4">
        <BlackCardComponent 
          :text="blackCard.text" 
          :num-pick="blackCard.pick"
          :card-id="blackCard.id"
          :flipped="false"
          :three-deffect="true"
        />
      </div>
      <p class="mb-4 text-center">👑 <strong>Judge:</strong> {{ getPlayerName(czarId) }}</p>

      <!-- Card Czar View -->
      <div v-if="isCzar" class="text-center">
        <div v-if="allCardsRevealed" class="grid grid-cols-4 gap-4 mt-4">
          <div 
            v-for="sub in otherSubmissions" 
            :key="sub.playerId"
            class="card-group"
          >
            <p class="font-medium mb-2">{{ getPlayerName(sub.playerId) }}</p>
            <div class="flex flex-col gap-2">
              <div 
                v-for="cardId in sub.cards" 
                :key="cardId"
                class="card-wrapper"
              >
                <whiteCard 
                  :cardId="cardId" 
                  :flipped="false"
                />
              </div>
            </div>
            <button 
              class="select-winner-btn mt-2" 
              @click="handleSelectWinner(sub.playerId)"
            >
              Select Winner
            </button>
          </div>
        </div>
        <div v-else>
          <p class="mb-4">Click on cards to reveal them to everyone:</p>
          <div class="grid grid-cols-4 gap-4">
            <div 
              v-for="(sub, index) in shuffledSubmissions" 
              :key="index"
              class="card-wrapper"
              @click="revealCard(index)"
            >
              <whiteCard 
                v-for="(cardId, cardIndex) in sub.cards" 
                :key="cardId"
                :cardId="cardId" 
                :flipped="!revealedCards[index]"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Other Players View -->
      <div v-else>
        <div v-if="Object.keys(revealedCards).length > 0" class="mt-4">
          <p class="font-semibold mb-2">Revealed submissions:</p>
          <div class="grid grid-cols-4 gap-4">
            <div 
              v-for="(sub, index) in shuffledSubmissions" 
              :key="index"
              class="card-wrapper"
              v-show="revealedCards[index]"
            >
              <whiteCard 
                v-for="cardId in sub.cards" 
                :key="cardId"
                :cardId="cardId" 
                :flipped="false"
              />
            </div>
          </div>
        </div>
        <div v-else-if="submissions[myId]" class="text-center p-4 mb-4">
          <p class="font-semibold">You've submitted your cards:</p>
          <div class="flex justify-center mt-2 gap-2">
            <whiteCard 
              v-for="cardId in submissions[myId]" 
              :key="cardId" 
              :cardId="cardId"
            />
          </div>
          <p class="mt-4 italic">Waiting for the judge to reveal submissions...</p>
        </div>
        <p v-else class="italic text-center mt-4">Waiting for the judge to reveal submissions...</p>
      </div>
    </div>
    <div v-else-if="isJudging && !blackCard" class="text-center p-4">
      <p class="text-xl font-bold">Waiting for black card to be drawn...</p>
    </div>

    <!-- Game Over -->
    <div v-else-if="isComplete">
      <h3 class="text-lg font-semibold">🏁 Game Over</h3>
      <ul class="mt-2 space-y-1">
        <li v-for="entry in leaderboard" :key="entry.playerId">
          {{ getPlayerName(entry.playerId) }} — {{ entry.points }} points
        </li>
      </ul>
    </div>

    <!-- Fallback -->
    <div v-else>
      <p class="italic">Waiting for game state...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, type Ref } from 'vue'
import type { Player } from '~/types/player'
import type { Lobby } from '~/types/lobby'
import { useGameContext } from '~/composables/useGameContext'
import { useGameActions } from '~/composables/useGameActions'
import { useUserStore } from '~/stores/userStore'
import { useLobby } from '~/composables/useLobby'
import UserHand from '~/components/game/UserHand.vue'
import whiteCard from '~/components/whiteCard.vue'
import BlackCardComponent from '~/components/blackCard.vue'
import PlayerList from '~/components/PlayerList.vue'

const props = defineProps<{ lobby: Lobby; players: Player[] }>()
const emit = defineEmits<{
  (e: 'leave'): void
}>()

const lobbyRef = ref(props.lobby)
// Keep lobbyRef in sync with props.lobby
watch(() => props.lobby, (newLobby) => {
  lobbyRef.value = newLobby
}, { immediate: true })

const { state, isSubmitting, isJudging, isComplete, isCzar, myHand, submissions, otherSubmissions, czarId, blackCard, leaderboard, hands } = useGameContext(lobbyRef)
const { playCard, selectWinner } = useGameActions()
const { leaveLobby } = useLobby()
const userStore = useUserStore()
const myId = userStore.user?.$id ?? ''

// Helper function to get player name from ID
const getPlayerName = (playerId: string): string => {
  const player = props.players.find(p => p.userId === playerId)
  return player?.name || "Unknown Player"
}

// Track which cards have been revealed (index -> boolean)
const revealedCards = ref<Record<number, boolean>>({})
// Store shuffled submissions to prevent re-shuffling on every render
const shuffledSubmissions = ref<any[]>([])

// Reset revealed cards and shuffle submissions when phase changes or submissions change
watch([isJudging, otherSubmissions], ([newIsJudging, newSubmissions]) => {
  if (newIsJudging) {
    revealedCards.value = {}

    // Shuffle submissions
    shuffledSubmissions.value = [...newSubmissions]
    // Fisher-Yates shuffle
    for (let i = shuffledSubmissions.value.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledSubmissions.value[i], shuffledSubmissions.value[j]] = 
        [shuffledSubmissions.value[j], shuffledSubmissions.value[i]]
    }
  }
}, { immediate: true })

// Check if all cards are revealed
const allCardsRevealed = computed(() => {
  return Object.keys(revealedCards.value).length === shuffledSubmissions.value.length
})

// Reveal a card
function revealCard(index: number) {
  if (!revealedCards.value[index]) {
    revealedCards.value = { ...revealedCards.value, [index]: true }
  }
}

function handleCardSubmit(cardIds: string[]) {
  playCard(props.lobby.$id, myId, cardIds)
}

function handleSelectWinner(playerId: string) {
  selectWinner(props.lobby.$id, playerId)
}

function handleLeave() {
  // Call the leaveLobby function from useLobby
  leaveLobby(props.lobby.$id, myId)
  // Emit the leave event to the parent component
  emit('leave')
}
</script>

<style scoped>
.card { padding: 1rem; background: white; color: black; border-radius: 0.5rem; }
.white { background: #f8f8f8; }
.submission { background: #ffeeba; }

.leave-button {
  background-color: #e74c3c;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.25rem;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.leave-button:hover {
  background-color: #c0392b;
}

.card-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  padding: 1rem;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card-group:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.card-wrapper {
  cursor: pointer;
  transition: transform 0.3s ease;
}

.card-wrapper:hover {
  transform: translateY(-5px);
}

.select-winner-btn {
  background-color: #4CAF50;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.25rem;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.select-winner-btn:hover {
  background-color: #45a049;
}

/* Round indicator styles */
.round-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background-color: rgba(255, 215, 0, 0.2);
  border: 2px solid rgba(255, 215, 0, 0.5);
  border-radius: 50%;
}

.round-number {
  font-size: 1.2rem;
  font-weight: bold;
  color: rgba(255, 215, 0, 0.9);
}

.player-score {
  background-color: rgba(0, 0, 0, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  color: rgba(255, 215, 0, 0.9);
}
</style>
