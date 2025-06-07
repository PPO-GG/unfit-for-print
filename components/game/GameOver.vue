<script lang="ts" setup>
import type { Player } from '~/types/player'

const props = defineProps({
  leaderboard: {
    type: Array,
    required: true
  },
  players: {
    type: Array,
    required: true
  }
})

const { t } = useI18n()

// Helper function to get player name from ID
const getPlayerName = (playerId) => {
  // First try to find the player in the props.players array by userId
  const playerByUserId = props.players.find(p => p.userId === playerId)
  if (playerByUserId?.name) {
    return playerByUserId.name
  }

  // Then try to find the player in the props.players array by $id
  const playerById = props.players.find(p => p.$id === playerId)
  if (playerById?.name) {
    return playerById.name
  }

  return t('lobby.unknown_player')
}
</script>

<template>
  <div class="text-center mt-10">
    <h3 class="text-2xl font-bold text-gray-100">🏁 {{ t('game.game_over') }}</h3>
    <ul class="mt-6 space-y-2">
      <li v-for="entry in leaderboard" :key="entry.playerId" class="font-medium text-gray-400">
        {{ getPlayerName(entry.playerId) }} — {{ entry.points }} {{ t('game.points') }}
      </li>
    </ul>
  </div>
</template>