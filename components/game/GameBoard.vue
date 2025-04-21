// GameBoard.vue
<template>
  <div class="p-4">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold">Round {{ state?.round }}</h2>
      <button 
        class="leave-button"
        @click="handleLeave"
      >
        Leave Game
      </button>
    </div>

    <!-- Submission Phase -->
    <div v-if="isSubmitting">
      <p class="mb-4">🖤 <strong>Prompt:</strong> {{ blackCard.text }}</p>

      <!-- Show message for the Judge -->
      <div v-if="isCzar" class="text-center p-4">
        <p class="text-xl font-bold">You are the Judge for this round!</p>
        <p class="mt-2">Wait for other players to submit their cards.</p>
      </div>

      <!-- User's hand will be displayed at the bottom of the screen (only for non-Judges) -->
      <UserHand 
        v-else
        :cards="myHand" 
        :disabled="!!submissions[myId]"
        :cards-to-select="blackCard.pick"
        @select-cards="handleCardSubmit"
      />
    </div>

    <!-- Judging Phase -->
    <div v-else-if="isJudging">
      <p class="mb-4">👑 <strong>Judge:</strong> {{ czarId }}</p>
      <div v-if="isCzar" class="grid grid-cols-4 gap-2">
        <button
            v-for="sub in otherSubmissions"
            :key="sub.playerId"
            class="card submission"
            @click="handleSelectWinner(sub.playerId)"
        >
          {{ sub.cards.join(', ') }}<br><small>(by {{ sub.playerId }})</small>
        </button>
      </div>
      <p v-else class="italic">Waiting for the judge to pick the funniest submission...</p>
    </div>

    <!-- Game Over -->
    <div v-else-if="isComplete">
      <h3 class="text-lg font-semibold">🏁 Game Over</h3>
      <ul class="mt-2 space-y-1">
        <li v-for="entry in leaderboard" :key="entry.playerId">
          {{ entry.playerId }} — {{ entry.points }} points
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
import { ref } from 'vue'
import type { Player } from '~/types/player'
import type { Lobby } from '~/types/lobby'
import { useGameContext } from '~/composables/useGameContext'
import { useGameActions } from '~/composables/useGameActions'
import { useUserStore } from '~/stores/userStore'
import { useLobby } from '~/composables/useLobby'
import UserHand from '~/components/game/UserHand.vue'

const props = defineProps<{ lobby: Lobby; players: Player[] }>()
const emit = defineEmits<{
  (e: 'leave'): void
}>()

const { state, isSubmitting, isJudging, isComplete, isCzar, myHand, submissions, otherSubmissions, czarId, blackCard, leaderboard } = useGameContext(ref(props.lobby))
const { submitCards, selectWinner } = useGameActions()
const { leaveLobby } = useLobby()
const userStore = useUserStore()
const myId = userStore.user?.$id ?? ''

function handleCardSubmit(cardIds: string[]) {
  submitCards(props.lobby.$id, myId, cardIds)
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
</style>
