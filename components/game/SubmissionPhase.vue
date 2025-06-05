<script lang="ts" setup>
import type { Player } from '~/types/player'

const props = defineProps({
  isJudge: {
    type: Boolean,
    required: true
  },
  submissions: {
    type: Object,
    required: true
  },
  myId: {
    type: String,
    required: true
  },
  blackCard: {
    type: Object,
    default: null
  },
  myHand: {
    type: Array,
    default: () => []
  },
  isParticipant: {
    type: Boolean,
    required: true
  },
  isSpectator: {
    type: Boolean,
    required: true
  },
  isHost: {
    type: Boolean,
    required: true
  },
  players: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['select-cards', 'convert-to-player'])

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

function handleCardSubmit(cardIds) {
  emit('select-cards', cardIds)
}

function convertToPlayer(playerId) {
  emit('convert-to-player', playerId)
}
</script>

<template>
  <div class="w-full flex flex-col items-center">
    <!-- Judge View -->
    <div v-if="isJudge" class="text-center">
      <p class="uppercase font-['Bebas_Neue'] text-4xl font-bold">{{ t('game.you_are_judge') }}</p>
      <p class="text-slate-400 font-['Bebas_Neue'] font-light">{{ t('game.waiting_for_submissions') }}</p>
      <!-- See who already submitted -->
      <div v-if="Object.keys(submissions).length > 0" class="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
        <div v-for="playerId in Object.keys(submissions)" :key="playerId"
             class="p-8 outline-2 outline-green-900 bg-slate-800 rounded-xl shadow-md text-center">
          <p class="font-bold text-white uppercase font-['Bebas_Neue'] text-3xl">{{ getPlayerName(playerId) }}</p>
          <p class="text-green-500 uppercase font-['Bebas_Neue'] text-xl font-medium">
            {{ t('game.player_submitted') }}</p>
        </div>
      </div>
    </div>

    <!-- Player View -->
    <div v-else>
      <!-- Player has submitted -->
      <div v-if="submissions[myId]" class="text-center">
        <p class="uppercase font-['Bebas_Neue'] text-4xl font-bold">{{ t('game.you_submitted') }}</p>
        <div class="flex justify-center gap-4">
          <whiteCard v-for="cardId in submissions[myId]" :key="cardId" :cardId="cardId"/>
        </div>
        <p class="mt-4 italic text-gray-500">{{ t('game.waiting_for_submissions') }}</p>
      </div>
      
      <!-- Participant view with UserHand -->
      <div v-if="blackCard && isParticipant && !submissions[myId]"
           class="w-full flex justify-center items-end bottom-0 fixed translate-x-[-50%] z-50">
        <UserHand
            :cards="myHand"
            :cardsToSelect="blackCard?.pick || 1"
            :disabled="isJudge || false"
            @select-cards="handleCardSubmit"
        />
      </div>

      <!-- Spectator view with message -->
      <div v-if="blackCard && isSpectator" class="w-full flex justify-center mt-8">
        <div class="spectator-message bg-slate-800 p-6 rounded-xl text-center max-w-md">
          <p class="text-xl mb-4">{{ t('game.you_are_spectating') }}</p>
          <!-- Only show this button to the host -->
          <UButton
              v-if="isHost"
              color="primary"
              icon="i-mdi-account-plus"
              @click="convertToPlayer(myId)"
          >
            {{ t('game.convert_to_participant') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>