<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useGame } from '~/composables/useGame';
import { getAppwrite } from '~/utils/appwrite';
import { useUserStore } from '~/stores/userStore';
import type { Lobby } from '~/types/lobby';

const props = defineProps<{ lobby: Lobby }>();

const { gameState, isJudge } = useGame(toRef(() => props.lobby));
const userStore = useUserStore();
const { submittedCards, loadSubmittedCards } = useSubmittedCards(lobby.value!.$id);

watch(
    () => gameState.value?.playedCards,
    (newVal) => {
      if (isJudge.value && newVal && Object.keys(newVal).length > 0) {
        loadSubmittedCards();
      }
    },
    { immediate: true }
);
</script>

<template>
  <div v-if="isJudge && submittedCards.length" class="mt-8">
    <h2 class="text-xl font-bold mb-4">Submitted Cards</h2>
    <div class="flex flex-wrap gap-4">
      <WhiteCard
          v-for="card in submittedCards"
          :key="card.cardId"
          :card-id="card.cardId"
          :text="card.text"
          @click="$emit('select', card.cardId)"
          class="cursor-pointer hover:scale-105 transition-transform"
      />
    </div>
  </div>
</template>
