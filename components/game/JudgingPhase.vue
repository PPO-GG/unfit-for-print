<script lang="ts" setup>
import type { Player } from '~/types/player'

const props = defineProps({
  isJudge: {
    type: Boolean,
    required: true
  },
  myId: {
    type: String,
    required: true
  },
  otherSubmissions: {
    type: Array,
    required: true
  },
  submissions: {
    type: Object,
    required: true
  },
  effectiveRoundWinner: {
    type: String,
    default: null
  },
  winnerSelected: {
    type: Boolean,
    default: false
  },
  shuffledSubmissions: {
    type: Array,
    required: true
  },
  players: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['select-winner'])

const { t } = useI18n()

// Track which submission is currently visible
const activeSubmissionIndex = ref(0)

// Determine if horizontal scrolling is needed based on total number of
// submissions (player + others). We approximate that more than two
// submissions will overflow on most screen sizes and therefore need
// scrolling.
const totalSubmissions = computed(() => {
  const mySubmission = props.submissions[props.myId] ? 1 : 0
  return props.shuffledSubmissions.length + mySubmission
})

const shouldShowScroll = computed(() => totalSubmissions.value > 2)

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

function handleSelectWinner(playerId) {
  emit('select-winner', playerId)
}

// Handle scroll events to update the active submission index
function handleScroll(event) {
  if (!props.otherSubmissions.length) return

  const container = event.target
  // Use a responsive card width based on screen size
  let cardWidth = 250 // Default for mobile (smallest size)
  const windowWidth = window.innerWidth

  if (windowWidth >= 640) { // sm breakpoint
    cardWidth = 300
  }
  if (windowWidth >= 768) { // md breakpoint
    cardWidth = 350
  }

  // Add the gap to the card width
  const gapWidth = windowWidth >= 640 ? 24 : 16 // 6*4=24 for sm and up, 4*4=16 for mobile
  const totalCardWidth = cardWidth + gapWidth

  const scrollPosition = container.scrollLeft

  // Calculate which card is most visible
  const index = Math.round(scrollPosition / totalCardWidth)

  // Clamp the index to valid range
  activeSubmissionIndex.value = Math.max(0, Math.min(index, props.otherSubmissions.length - 1))
}
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-slate-700/25 border-y-2 border-b-slate-700 border-t-slate-900 rounded-3xl p-4 sm:p-6 md:p-8 text-center w-full outline-2 outline-slate-400/25">
    <p v-if="!isJudge" class="text-center mb-4 sm:mb-6 text-slate-100 text-2xl sm:text-3xl font-['Bebas_Neue']">
      {{ t('game.submissions') }}</p>

    <!-- Judge view -->
    <div v-if="isJudge" class="flex-1 flex flex-col overflow-hidden w-full">
      <!-- Top Message -->
      <p v-if="!winnerSelected" class="text-center mb-4 sm:mb-6 text-slate-100 text-2xl sm:text-3xl font-['Bebas_Neue']">
        {{ t('game.select_winner') }}
      </p>

      <!-- Unified view with horizontal scrolling and snap scrolling -->
      <div class="flex-1 overflow-hidden">
        <div class="bg-slate-800/50 p-4 rounded-xl w-full h-full">
          <!-- Horizontal scrolling container with snap scrolling -->
          <div
            ref="submissionsContainer"
            :class="[
              'pb-4 snap-x snap-mandatory flex gap-4 sm:gap-6 w-full h-full',
              shouldShowScroll ? 'overflow-x-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800' : 'justify-center'
            ]"
            @scroll="handleScroll">
            <!-- Add a spacer at the beginning to center the first card on smaller screens -->
            <div v-if="shouldShowScroll" class="flex-shrink-0 w-[calc(50%-125px)] min-w-[10px] sm:min-w-[20px] md:min-w-[50px]"></div>

            <div
                v-for="sub in otherSubmissions"
                v-show="!effectiveRoundWinner || effectiveRoundWinner === sub.playerId"
                :key="sub.playerId"
                :class="{'border-2 border-green-500': effectiveRoundWinner === sub.playerId}"
                class="snap-center flex-shrink-0 inset-shadow-sm inset-shadow-slate-900 flex flex-col items-center outline-2 outline-slate-400/15 rounded-3xl bg-slate-700/50 p-3 sm:p-4 md:p-6 w-[250px] sm:w-[300px] md:w-[350px]"
            >
              <div class="flex flex-nowrap overflow-x-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800 justify-start gap-2 mb-4 pb-2 max-w-full">
                <whiteCard
                    v-for="cardId in sub.cards"
                    :key="cardId"
                    :cardId="cardId"
                    :flipped="false"
                    :is-winner="effectiveRoundWinner === sub.playerId"
                />
              </div>

              <UButton
                  v-if="!winnerSelected"
                  class="w-full rounded-lg mt-2 cursor-pointer"
                  color="secondary"
                  size="lg"
                  variant="solid"
                  @click="handleSelectWinner(sub.playerId)"
              >
                <span class="text-white text-center w-full font-light text-lg sm:text-xl font-['Bebas_Neue']">
                  {{ t('game.select_winner') }}
                </span>
              </UButton>

              <p v-else-if="effectiveRoundWinner === sub.playerId" class="text-green-400 font-bold mt-1 sm:mt-2 text-sm sm:text-base">
                🏆 {{ t('game.winner') }} 🏆
              </p>
            </div>

            <!-- Add a spacer at the end to center the last card on smaller screens -->
            <div v-if="shouldShowScroll" class="flex-shrink-0 w-[calc(50%-125px)] min-w-[10px] sm:min-w-[20px] md:min-w-[50px]"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Other players view -->
    <div v-else class="w-full">
      <div :class="[
            'pb-4 flex gap-4 sm:gap-6 md:gap-8 snap-x snap-mandatory',
            shouldShowScroll ? 'overflow-x-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800' : 'justify-center'
        ]">
        <!-- Spacer at the start for centering on small screens -->
        <div v-if="shouldShowScroll" class="flex-shrink-0 w-[calc(50%-125px)] min-w-[10px] sm:min-w-[20px] md:min-w-[50px]"></div>

        <!-- Current player's submission -->
        <div v-if="submissions[myId]"
             :class="[
                'snap-center flex-shrink-0 outline-2 outline-slate-400/25 outline-dashed rounded-3xl bg-slate-700/50 p-3 sm:p-4 md:p-6 w-[250px] sm:w-[300px] md:w-[350px]',
                { 'border-2 border-green-500': effectiveRoundWinner === myId }
             ]">
          <p class="font-medium text-white mb-1 sm:mb-2 text-base sm:text-lg">
            <span class="text-success-400 font-['Bebas_Neue'] text-xl sm:text-2xl">{{ t('game.your_submission') }}</span>
          </p>
          <div class="flex flex-nowrap justify-start gap-2 mb-2 pb-2 max-w-full">
            <whiteCard
                v-for="cardId in submissions[myId]"
                :key="cardId"
                :cardId="cardId"
                :flipped="false"
                :is-winner="effectiveRoundWinner === myId"
            />
          </div>
          <p v-if="effectiveRoundWinner === myId" class="text-green-400 font-bold mt-1 sm:mt-2 text-sm sm:text-base">
            🏆 {{ t('game.you_won') }} 🏆
          </p>
        </div>

        <!-- Other players' submissions -->
        <template v-if="shuffledSubmissions.length > 0">
          <div
              v-for="(sub) in shuffledSubmissions"
              v-show="sub.playerId !== myId"
              :key="sub.playerId"
              :class="[
                'snap-center flex-shrink-0 outline-2 outline-slate-400/25 outline-dashed rounded-3xl bg-slate-700/50 p-3 sm:p-4 md:p-6 w-[250px] sm:w-[300px] md:w-[350px]',
                { 'border-2 border-green-500': effectiveRoundWinner === sub.playerId }
              ]"
          >
            <p v-if="effectiveRoundWinner === sub.playerId"
               class="font-medium text-amber-300 mb-1 sm:mb-2 font-['Bebas_Neue'] text-xl sm:text-2xl">
              <span class="text-amber-400">{{ t('game.submitted_by') }} </span>{{ getPlayerName(sub.playerId) }}
            </p>
            <p v-else class="font-medium text-white mb-1 sm:mb-2 text-base sm:text-lg">
              <span class="text-amber-400 font-['Bebas_Neue'] text-xl sm:text-2xl">{{ t('game.submissions') }}</span>
            </p>
            <div class="flex flex-nowrap justify-start gap-2 mb-2 pb-2 max-w-full">
              <whiteCard
                  v-for="cardId in sub.cards"
                  :key="cardId"
                  :cardId="cardId"
                  :flipped="false"
                  :is-winner="effectiveRoundWinner === sub.playerId"
              />
            </div>
            <p v-if="effectiveRoundWinner === sub.playerId" class="text-green-400 font-bold mt-1 sm:mt-2 text-sm sm:text-base">
              🏆 {{ t('game.winner') }} 🏆
            </p>
          </div>
        </template>

        <!-- Spacer at the end for centering on small screens -->
        <div v-if="shouldShowScroll" class="flex-shrink-0 w-[calc(50%-125px)] min-w-[10px] sm:min-w-[20px] md:min-w-[50px]"></div>
      </div>
      <p v-if="shuffledSubmissions.length === 0" class="text-center italic text-gray-500 mt-4 sm:mt-6 text-sm sm:text-base">{{ t('game.waiting_for_submissions') }}</p>
    </div>
  </div>
</template>
