<template>
  <div class="game-board grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] h-screen p-4 gap-4 bg-slate-900 text-white">
    <!-- Black Card Stack -->
    <div class="row-span-2 flex flex-col items-center justify-start">
      <BlackCardStack
          :is-judge="isJudge"
          @draw="emit('drawBlackCard')"
      />
    </div>

    <!-- Current Black Card -->
    <div class="flex items-center justify-center">
      <BlackCard
          v-if="gameState.blackCard"
          :text="gameState.blackCard.text"
          :card-pack="gameState.blackCard.pack || 'core'"
          :back-logo-url="'/img/unfit_logo_alt_dark.png'"
          :mask-url="'/img/textures/hexa2.png'"
      />
    </div>

    <!-- Player List / Sidebar -->
    <div class="row-span-2 flex flex-col gap-2 w-64">
      <PlayerList
          :players="players"
          :hostUserId="lobby.hostUserId"
          :lobbyId="lobby.$id"
          :allow-moderation="true"
      />
      <UButton
          class="mt-4 bg-red-700 hover:bg-red-600 text-white"
          icon="i-lucide-log-out"
          @click="emit('leave')"
      >
        Leave Lobby
      </UButton>
    </div>

    <!-- Submitted Cards Area -->
    <div v-if="isJudge && Object.keys(gameState.playedCards || {}).length" class="flex flex-wrap gap-4 justify-center items-start">
      <SubmittedCards
          :lobby="lobby"
          @select="emit('selectWinner', $event)"
      />
    </div>

    <!-- White Card Hand -->
    <div v-if="isPlaying && hand.length" class="col-span-3 flex justify-center gap-4">
      <WhiteCard
          v-for="cardId in hand"
          :key="cardId"
          :card-id="cardId"
          :text="whiteCardTexts[cardId]"
          :disabled="hasSubmittedCard"
          :card-pack="'core'"
          :back-logo-url="'/img/unfit_logo_alt_dark.png'"
          :mask-url="'/img/textures/hexa2.png'"
          @click="() => emit('submitCard', cardId)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref } from 'vue';
import type { Lobby } from '~/types/lobby';
import type { Player } from '~/types/player';
import { useGame } from '~/composables/useGame';
import PlayerList from '~/components/PlayerList.vue';
import WhiteCard from '~/components/whiteCard.vue';
import BlackCard from '~/components/blackCard.vue';
import BlackCardStack from '~/components/BlackCardStack.vue';
import SubmittedCards from '~/components/SubmittedCards.vue';

const props = defineProps<{
  lobby: Lobby;
  players: Player[];
  whiteCardTexts: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'submitCard', cardId: string): void;
  (e: 'selectWinner', cardId: string): void;
  (e: 'drawBlackCard'): void;
  (e: 'leave'): void;
}>();

const { gameState, getHand, hasSubmittedCard, isJudge, isPlaying } = useGame(ref(props.lobby));
const hand = computed(() => getHand.value);
</script>

<style scoped>
.game-board {
  overflow: hidden;
}
</style>