<script setup lang="ts">
import { useGameContext } from '~/composables/useGameContext'
import { useGame } from '~/composables/useGame';
const { isJudge, gameState } = useGameContext(lobby)

const reveal = async () => {
  // Only judge can trigger
  if (!isJudge.value || gameState.value.blackCard) return;

  const nextCardId = gameState.value.blackDeck[0];
  const cardData = await getCardById(nextCardId, 'black_cards');
  await updateGameState({ blackCard: cardData, blackDeck: gameState.value.blackDeck.slice(1) });
};
</script>

<template>
  <WhiteCard
      class="cursor-pointer transition-all transform hover:scale-105"
      @click="reveal"
      :flipped="false"
  />
</template>

<style scoped>

</style>