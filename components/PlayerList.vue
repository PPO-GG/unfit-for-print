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
          class="flex items-center gap-2"
      >
        <span v-if="player.userId === hostUserId">
          <Icon name="solar:crown-minimalistic-bold" class="align-middle text-slate-100"/>
        </span>
        <span>{{ player.name || "Unknown Player" }}</span>
        <span class="ml-auto font-mono text-sm text-green-400">
          {{ getScoreForPlayer(player.userId) }}
        </span>
        <button
            v-if="isHost && player.userId !== currentUserId && player.provider !== 'anonymous'"
            @click="promote(player)"
            class="text-yellow-400 hover:text-yellow-500 text-xs ml-2"
        >
          Promote
        </button>
        <button
            v-if="isHost && player.userId !== currentUserId"
            @click="kick(player)"
            class="text-red-400 hover:text-red-500 text-xs"
        >
          Kick
        </button>
      </li>
    </ul>
  </div>
</template>