<script setup lang="ts">
import { ref, watch, computed } from "vue";

const props = defineProps<{
  modelValue: boolean;
  processing: boolean;
  loading: boolean;
  pairs: any[];
}>();

const emit = defineEmits(["update:modelValue", "action"]);

const cardToKeep = ref<string>("card1");
const currentPairIndex = ref(0);

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      cardToKeep.value = "card1";
      currentPairIndex.value = 0;
    }
  },
);

const currentPair = computed(() => props.pairs[currentPairIndex.value] || null);

const handleAction = () => {
  if (!currentPair.value || !cardToKeep.value) return;
  emit("action", {
    pair: currentPair.value,
    keep: cardToKeep.value,
    index: currentPairIndex.value,
  });

  // Optimistically assume parent will remove the pair
  // We'll watch length to correct out of bounds
};

watch(
  () => props.pairs.length,
  (newLen) => {
    if (newLen === 0 && props.modelValue) {
      emit("update:modelValue", false);
    } else if (currentPairIndex.value >= newLen && newLen > 0) {
      currentPairIndex.value = Math.max(0, newLen - 1);
    }
  },
);

const goToNextPair = () => {
  if (currentPairIndex.value < props.pairs.length - 1) {
    currentPairIndex.value++;
    cardToKeep.value = "card1"; // reset selection on next
  }
};

const goToPreviousPair = () => {
  if (currentPairIndex.value > 0) {
    currentPairIndex.value--;
    cardToKeep.value = "card1"; // reset selection
  }
};
</script>

<template>
  <UModal
    :open="modelValue"
    @update:open="$emit('update:modelValue', $event)"
    size="xl"
  >
    <template #header>
      <h3 class="text-lg font-medium">All Similar Cards</h3>
    </template>
    <template #body>
      <div v-if="processing" class="flex justify-center py-8">
        <UIcon
          name="i-solar-restart-circle-line-duotone"
          class="animate-spin h-8 w-8 text-gray-400"
        />
        <span class="ml-2 text-gray-400"
          >Processing cards... This may take a moment.</span
        >
      </div>
      <div v-else-if="props.pairs.length > 0" class="space-y-6">
        <div class="text-sm text-gray-400 mb-4">
          Select which card to keep and which to delete. Navigate through all
          similar pairs using the buttons below.
        </div>

        <div v-if="currentPair" class="border border-gray-700 rounded-lg p-4">
          <div class="flex justify-between items-start mb-4">
            <div class="text-sm text-gray-400">
              Similarity:
              <span class="font-bold text-info-400"
                >{{ currentPair.similarityScore }}%</span
              >
            </div>
            <div class="flex gap-2">
              <UBadge color="info" variant="subtle"
                >Pair {{ currentPairIndex + 1 }} of
                {{ props.pairs.length }}</UBadge
              >
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6">
            <!-- Card 1 -->
            <div class="space-y-2">
              <h4 class="font-medium">Card 1</h4>
              <div
                class="bg-slate-800 rounded p-3 text-sm font-mono text-white cursor-pointer border-2"
                :class="
                  cardToKeep === 'card1' ? 'border-green-500' : 'border-red-500'
                "
                @click="cardToKeep = 'card1'"
              >
                {{ currentPair.card1.text }}
              </div>
              <div class="text-xs text-gray-400">
                Pack: {{ currentPair.card1.pack }} | ID:
                {{ currentPair.card1.$id }}
              </div>
            </div>

            <!-- Card 2 -->
            <div class="space-y-2">
              <h4 class="font-medium">Card 2</h4>
              <div
                class="bg-slate-800 rounded p-3 text-sm font-mono text-white cursor-pointer border-2"
                :class="
                  cardToKeep === 'card2' ? 'border-green-500' : 'border-red-500'
                "
                @click="cardToKeep = 'card2'"
              >
                {{ currentPair.card2.text }}
              </div>
              <div class="text-xs text-gray-400">
                Pack: {{ currentPair.card2.pack }} | ID:
                {{ currentPair.card2.$id }}
              </div>
            </div>
          </div>

          <div class="flex justify-center mt-6 w-full">
            <UButton
              color="error"
              @click="handleAction"
              :loading="loading"
              class="w-full"
              :disabled="!cardToKeep"
            >
              Delete {{ cardToKeep === "card1" ? "Card 2" : "Card 1" }}
            </UButton>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-8 text-gray-400">
        No similar cards found.
      </div>
    </template>
    <template #footer>
      <div class="flex justify-between items-center">
        <div class="text-sm text-gray-400">
          {{ props.pairs.length }} similar pairs found
        </div>
        <div class="flex gap-2">
          <UButton
            color="neutral"
            variant="soft"
            icon="i-solar-arrow-left-line-duotone"
            :disabled="currentPairIndex === 0 || props.pairs.length === 0"
            @click="goToPreviousPair"
          >
            Previous
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            icon-right="i-solar-arrow-right-line-duotone"
            :disabled="
              currentPairIndex >= props.pairs.length - 1 ||
              props.pairs.length === 0
            "
            @click="goToNextPair"
          >
            Next
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            @click="$emit('update:modelValue', false)"
          >
            Close
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
