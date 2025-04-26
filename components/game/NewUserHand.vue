<template>
  <!-- 🔘 Drawer Toggle Button -->
  <div class="fixed bottom-4 inset-x-0 flex justify-center z-30">
    <UButton
        icon="i-mdi-cards"
        label="Show Hand"
        size="lg"
        color="primary"
        class="transition-opacity duration-500 ease-in-out bg-green-500 w-48 h-16 text-2xl rounded-xl shadow-lg font-['Bebas_Neue']"
        :class="{ 'opacity-0 pointer-events-none': open }"
        @click="open = true"
    />
  </div>

  <!-- 🃏 Card Drawer -->
  <UDrawer
      v-model:open="open"
      :dismissible="false"
      :overlay="false"
      :handle="false"
      side="bottom"
      class="max-h-[70vh]"
      :content="{
      disableOutsidePointerEvents: false,
      trapFocus: false
    }"
  >

    <!-- 🎯 Floating Submit Bar -->
    <template #content>
      <!-- ❌ Close Button -->
      <div class="relative">
        <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xl"
            class="absolute top-6 right-6 w-8 h-8 z-10"
            @click="open = false"
        />
      </div>
        <div class="flex justify-center">
          <UButton
              :disabled="selectedCards.length !== cardsToSelect || disabled"
              icon="i-lucide-rocket"
              size="xl"
              variant="soft"
              color="primary"
              block
              class="mb-2 mt-2 w-1/2 sm:w-64 p-4 font-bold rounded-lg cursor-pointer disabled:bg-gray-500/50 disabled:text-gray-200/50"
              @click="submitCards"
          >
            <p class="text-lg font-['Bebas_Neue']">
              {{ selectedCards.length < cardsToSelect
                ? `Selected ${selectedCards.length} of ${cardsToSelect} cards`
                : 'Submit Cards'
              }}
            </p>
          </UButton>
        </div>

      <!-- 🧮 Scrollable Card Hand -->
      <div class="flex overflow-x-auto gap-3 px-4 py-6 sm:justify-center">
        <div
            v-for="card in cardObjects"
            :key="card.id"
            @click="handleCardClick(card.id)"
            class="relative flex-shrink-0 transition-all duration-300 ease-in-out cursor-pointer"
            :class="[
            selectedCards.includes(card.id)
              ? 'transform -translate-y-3 outline-green-500 shadow-green-500/50 shadow-xl'
              : 'outline-green-500/0 shadow-none',
            disabled ? 'opacity-60 cursor-not-allowed' : '',
            'rounded-xl outline-4'
          ]"
        >
          <whiteCard :cardId="card.id" :text="card.text" />
        </div>
      </div>
    </template>
  </UDrawer>
</template>


<script lang="ts" setup>
import {computed, ref} from 'vue'

const cardObjects = computed(() =>
    props.cards.map((id) => ({
      id,
      text: `Card: ${id}`
    }))
)

const props = defineProps<{
  cards: string[]
  disabled?: boolean
  cardsToSelect?: number
}>()
const open = ref(true)
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

function handleOverlayClick(cardId: string) {
  if (selectedCards.length === cardsToSelect) {
    submitCards()
  } else {
    handleCardClick(cardId) // acts as unselect
  }
}
</script>

<style scoped>
.cards-scroll-wrapper {
  display: flex;
  overflow-x: auto;
  scroll-padding-left: 1rem;
  -webkit-overflow-scrolling: touch;
}

.card-wrapper {
  flex: 0 0 auto;
  cursor: pointer;
  gap: 0.5rem;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card-wrapper.selected {
  transform: translateY(-12px);
}

.card-wrapper.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Match card size and reduce spacing */
:deep(.card-container) {
  width: 120px;
  height: 170px;
}

@media (min-width: 640px) {
  :deep(.card-container) {
    width: 140px;
    height: 190px;
  }
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
  background-color: #ccc;
  opacity: 0.7;
  cursor: not-allowed;
}

</style>