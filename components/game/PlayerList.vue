<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLobby } from '~/composables/useLobby'
import { useUserStore } from '~/stores/userStore'
import type { Player } from '~/types/player'
import { useGameContext } from '~/composables/useGameContext'
import type { Lobby } from '~/types/lobby'

const { t } = useI18n()
const props = defineProps<{
  players: Player[]
  hostUserId: string
  lobbyId: string
	judgeId?: string
  submissions?: Record<string, any>
  gamePhase?: string
  scores?: Record<string, number>
  avatarUrl?: string
}>()

const emit = defineEmits<{
  (e: 'convert-spectator', playerId: string): void
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
const { kickPlayer, promoteToHost, reshufflePlayerCards } = useLobby()
const userStore = useUserStore()
const { notify } = useNotifications()

const currentUserId = computed(() => userStore.user?.$id)
const isHost = computed(() => props.hostUserId === currentUserId.value)

const kick = async (player: Player) => {
  try {
    await kickPlayer(player.$id)
  } catch (err) {
    // console.error("Failed to kick player:", err)
	  notify({
			title: t('lobby.error_failed_to_kick', { name: player.name || 'Unknown Player' }),
			color: 'error'
		})
  }
}

const sortedPlayers = computed(() => {
    return props.players.slice().sort((a, b) => {
      if (a.userId === props.hostUserId) return -1
      if (b.userId === props.hostUserId) return 1
      return 0
    });
})

const promote = async (player: Player) => {
  try {
    await promoteToHost(props.lobbyId, player)
  } catch (err) {
    // console.error("Failed to promote host:", err)
	  notify({
			title: t('lobby.error_failed_to_promote', { name: player.name || 'Unknown Player' }),
			color: 'error'
		})
  }
}

const reshuffleCards = async () => {
  try {
    await reshufflePlayerCards(props.lobbyId)
	  notify({
			title: 'Cards Reshuffled',
			description: 'All player cards have been reshuffled',
			color: 'success'
		})
  } catch (err) {
    console.error("Failed to reshuffle cards:", err)
    notify({
      title: 'Error',
      description: 'Failed to reshuffle cards',
      color: 'error'
    })
  }
}

const getScoreForPlayer = (playerId: string) => {
  // Use the scores prop if available, otherwise fall back to the scores from useGameContext
  if (props.scores && playerId in props.scores) {
    return props.scores[playerId]
  }
  return scores.value[playerId] || 0
}

const getPlayerAvatarUrl = (player: Player) => {
  if (!player || !player.avatar) return null;

  // For providers that store direct URLs (like Google)
  if (player.provider === 'google') {
    return player.avatar;
  }

  // For Discord users
  if (player.provider === 'discord') {
    // Check if it's already a complete URL
    if (player.avatar.startsWith('https://cdn.discordapp.com/avatars/')) {
      return player.avatar;
    }

    // Otherwise, try to parse it as discordUserId/avatarHash
    const [discordUserId, avatarHash] = player.avatar.split('/');
    if (discordUserId && avatarHash) {
      return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatarHash}.png`;
    }
  }

  // For any other provider or format, return the avatar as is if it looks like a URL
  if (player.avatar.startsWith('http')) {
    return player.avatar;
  }

  // Return null if no avatar is available or not in a usable format
  return null;
};

</script>

<template>
  <div class="font-['Bebas_Neue'] rounded-xl xl:p-4 lg:p-2 shadow-lg w-full mx-auto border-2 border-slate-500 bg-slate-600">
    <ul class="uppercase text-lg">
      <li
          v-for="player in sortedPlayers"
          :key="player.$id"
          class="flex items-center gap-2 p-2 mb-2 rounded-lg"
          :class="{
            'bg-yellow-900/30 border border-yellow-500/30': player.userId === judgeId,
            'bg-blue-900/30 border border-blue-500/30': player.userId === currentUserId,
            'bg-slate-800/50': player.userId !== judgeId && player.userId !== currentUserId
          }"
      >
        <UAvatar
            v-if="getPlayerAvatarUrl(player)"
            :src="getPlayerAvatarUrl(player)"
            size="sm"
        />
        <UAvatar
            v-else
            size="sm"
            icon="i-solar-user-bold-duotone"
        />

        <!-- Host Crown -->
        <span v-if="player.userId === hostUserId" class="text-yellow-400">
          <Icon name="solar:crown-minimalistic-bold" class="align-middle"/>
        </span>

        <!-- Player Name -->
        <span class="font-medium truncate">{{ player.name || "Unknown Player" }}</span>
	      <span v-if="player.userId === currentUserId" class="text-xs text-gray-400">(YOU)</span>
        <!-- Player Status Indicators -->
        <div class="flex items-center ml-auto mr-2 gap-2">
          <span 
            v-if="player.playerType === 'spectator'" 
            class="status-badge bg-purple-500/20 text-purple-300"
          >
            <Icon name="mdi:eye" class="mr-1" />{{ t('game.spectator') }}
          </span>
          <!-- Card Judge Indicator -->
          <span v-else-if="player.userId === judgeId" class="status-badge bg-yellow-500/20 text-yellow-300">
            <Icon name="mdi:gavel" class="mr-1" />{{ t('game.judge') }}
          </span>

          <!-- Submitted Indicator -->
          <span 
            v-else-if="submissions && submissions[player.userId]" 
            class="status-badge bg-green-500/20 text-green-300"
          >
            <Icon name="mdi:check-circle" class="mr-1" />{{ t('game.player_submitted') }}
          </span>

          <!-- Waiting Indicator -->
          <span 
            v-else-if="gamePhase === 'submitting'" 
            class="status-badge bg-blue-500/20 text-blue-300"
          >
            <Icon name="mdi:timer-sand" class="mr-1" />{{ t('game.player_choosing') }}
          </span>
        </div>

        <!-- Player Score -->
        <span class="font-mono text-sm bg-slate-700/50 px-2 py-1 rounded text-green-400">
          {{ getScoreForPlayer(player.userId) }}
        </span>

        <!-- Admin Actions -->
        <div class="flex gap-1">
          <!-- Deal in spectator button -->
          <button
              v-if="isHost && player.userId !== currentUserId && player.playerType === 'spectator'"
              @click="emit('convert-spectator', player.userId)"
              class="admin-btn text-green-400 hover:text-green-300 hover:bg-green-900/30"
              title="{{ t('game.convert_to_participant') }}"
          >
            <Icon name="mdi:account-plus" />
          </button>
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
