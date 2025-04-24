<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLobby } from '~/composables/useLobby'
import { useUserStore } from '~/stores/userStore'
import type { Player } from '~/types/player'
import { useGameContext } from '~/composables/useGameContext'
import type { Lobby } from '~/types/lobby'

const props = defineProps<{
  players: Player[]
  hostUserId: string
  lobbyId: string
  czarId?: string
  submissions?: Record<string, any>
  gamePhase?: string
  scores?: Record<string, number>
}>()

// Create a ref for the lobby and initialize it with basic data
function createLobby(partial: Partial<Lobby>): Lobby {
  return {
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
    code: '',
    status: 'waiting',
    round: 0,
    ...partial
  } as Lobby
}

// Then use it like this:
const lobbyRef = ref<Lobby>(createLobby({
  $id: props.lobbyId,
  hostUserId: props.hostUserId,
  players: props.players.map(player => player.$id),
  gameState: JSON.stringify({
    phase: 'waiting',
    scores: {}
  })
}))


const { scores } = useGameContext(lobbyRef)
const { kickPlayer, promoteToHost } = useLobby()
const userStore = useUserStore()

const currentUserId = computed(() => userStore.user?.$id)
const isHost = computed(() => props.hostUserId === currentUserId.value)

const kick = async (player: Player) => {
  try {
    await kickPlayer(player.$id)
  } catch (err) {
    console.error("Failed to kick player:", err)
  }
}

const sortedPlayers = computed(() =>
    props.players.slice().sort((a, b) => {
      if (a.userId === props.hostUserId) return -1
      if (b.userId === props.hostUserId) return 1
      return 0
    })
)

const promote = async (player: Player) => {
  try {
    await promoteToHost(props.lobbyId, player)
  } catch (err) {
    console.error("Failed to promote host:", err)
  }
}

const getScoreForPlayer = (playerId: string) => {
  // Use the scores prop if available, otherwise fall back to the scores from useGameContext
  if (props.scores && playerId in props.scores) {
    return props.scores[playerId]
  }
  return scores.value[playerId] || 0
}
</script>

<template>
  <div class="mt-6 font-['Bebas_Neue'] bg-slate-600 rounded-xl p-6 shadow-lg w-full max-w-xs">
    <h2 class="text-3xl font-bold mb-2">Players</h2>
    <ul class="uppercase text-lg">
      <li
          v-for="player in sortedPlayers"
          :key="player.$id"
          class="flex items-center gap-2 p-2 mb-2 rounded-lg"
          :class="{
            'bg-yellow-900/30 border border-yellow-500/30': player.userId === czarId,
            'bg-blue-900/30 border border-blue-500/30': player.userId === currentUserId,
            'bg-slate-800/50': player.userId !== czarId && player.userId !== currentUserId
          }"
      >
        <!-- Host Crown -->
        <span v-if="player.userId === hostUserId" class="text-yellow-400">
          <Icon name="solar:crown-minimalistic-bold" class="align-middle"/>
        </span>

        <!-- Player Name -->
        <span class="font-medium">{{ player.name || "Unknown Player" }}</span>

        <!-- Player Status Indicators -->
        <div class="flex items-center ml-auto mr-2 gap-2">
          <!-- Card Czar Indicator -->
          <span v-if="player.userId === czarId" class="status-badge bg-yellow-500/20 text-yellow-300">
            <Icon name="mdi:gavel" class="mr-1" />Judge
          </span>

          <!-- Submitted Indicator -->
          <span 
            v-else-if="submissions && submissions[player.userId]" 
            class="status-badge bg-green-500/20 text-green-300"
          >
            <Icon name="mdi:check-circle" class="mr-1" />Submitted
          </span>

          <!-- Waiting Indicator -->
          <span 
            v-else-if="gamePhase === 'submitting'" 
            class="status-badge bg-blue-500/20 text-blue-300"
          >
            <Icon name="mdi:timer-sand" class="mr-1" />Choosing
          </span>
        </div>

        <!-- Player Score -->
        <span class="font-mono text-sm bg-slate-700/50 px-2 py-1 rounded text-green-400">
          {{ getScoreForPlayer(player.userId) }}
        </span>

        <!-- Admin Actions -->
        <div class="flex gap-1">
          <button
              v-if="isHost && player.userId !== currentUserId && player.provider !== 'anonymous'"
              @click="promote(player)"
              class="admin-btn text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/30"
          >
            <Icon name="mdi:crown" />
          </button>
          <button
              v-if="isHost && player.userId !== currentUserId"
              @click="kick(player)"
              class="admin-btn text-red-400 hover:text-red-300 hover:bg-red-900/30"
          >
            <Icon name="mdi:account-remove" />
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.status-badge {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  white-space: nowrap;
}

.admin-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.25rem;
  background-color: rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.admin-btn:hover {
  transform: translateY(-2px);
}
</style>
