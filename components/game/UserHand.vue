<template>
  <div class="user-hand">
    <div class="cards-container">
      <div 
        v-for="cardId in cards" 
        :key="cardId"
        class="card-wrapper"
        :class="{ 'selected': selectedCards.includes(cardId), 'disabled': disabled }"
        @click="handleCardClick(cardId)"
      >
        <whiteCard
          :cardId="cardId"
        />
      </div>
    </div>

    <div v-if="selectedCards.length > 0" class="submit-container">
      <p class="text-center mb-2">
        Selected {{ selectedCards.length }} of {{ cardsToSelect }} cards
      </p>
      <button 
        class="submit-button" 
        :disabled="selectedCards.length !== cardsToSelect || disabled"
        @click="submitCards"
      >
        Submit Cards
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import whiteCard from '~/components/whiteCard.vue'

const props = defineProps<{
  cards: string[]
  disabled?: boolean
  cardsToSelect?: number
}>()

const emit = defineEmits<{
  (e: 'select-cards', cardIds: string[]): void
}>()

// Default to 1 card if not specified
const cardsToSelect = computed(() => props.cardsToSelect || 1)

const selectedCards = ref<string[]>([])

function handleCardClick(cardId: string) {
  if (props.disabled) return

  const index = selectedCards.value.indexOf(cardId)

  if (index === -1) {
    // Card is not selected, add it if we haven't reached the limit
    if (selectedCards.value.length < cardsToSelect.value) {
      selectedCards.value.push(cardId)
    }
  } else {
    // Card is already selected, remove it
    selectedCards.value.splice(index, 1)
  }
}

function submitCards() {
  if (selectedCards.value.length === cardsToSelect.value && !props.disabled) {
    emit('select-cards', selectedCards.value)
    selectedCards.value = [] // Reset selection after submission
  }
}
</script>

<style scoped>
.user-hand {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10;
}

.cards-container {
  display: flex;
  justify-content: center;
  gap: 1rem;
  overflow-x: auto;
  padding-bottom: 1rem;
}

.card-wrapper {
  position: relative;
  cursor: pointer;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card-wrapper.disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.card-wrapper.disabled::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  z-index: 5;
}

.selected {
  transform: translateY(-20px);
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
}

.submit-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 1rem;
  color: white;
}

.submit-button {
  background-color: #4CAF50;
  color: white;
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  transition: background-color 0.3s ease;
}

.submit-button:hover:not(:disabled) {
  background-color: #45a049;
}

.submit-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
  opacity: 0.7;
}

/* Make the cards smaller to fit more in a row */
:deep(.card-container) {
  width: 150px;
  height: 200px;
  margin: 0.5rem;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
</style>
