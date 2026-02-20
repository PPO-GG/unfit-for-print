<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  modelValue: boolean;
  loading: boolean;
  selectedCard: any;
  similarCards: any[];
}>();

const emit = defineEmits(["update:modelValue", "action"]);

// default to keeping original
const cardToKeep = ref<string>("original");

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      cardToKeep.value = "original";
    }
  },
);

const handleAction = (similarCard: any) => {
  if (!cardToKeep.value) return;
  emit("action", { similarCard, keep: cardToKeep.value });
};
</script>

<template>
  <UModal
    :open="modelValue"
    @update:open="$emit('update:modelValue', $event)"
    size="xl"
  >
    <template #header>
      <h3 class="text-lg font-medium">Similar Cards</h3>
    </template>
    <template #body>
      <div v-if="loading" class="space-y-6">
        <div class="text-sm text-gray-400 mb-4">
          <USkeleton class="h-4 w-full" />
          <USkeleton class="h-4 w-3/4 mt-2" />
        </div>

        <div
          v-for="i in 2"
          :key="i"
          class="border border-gray-700 rounded-lg p-4"
        >
          <div class="flex justify-between items-start mb-4">
            <div class="text-sm text-gray-400">
              <USkeleton class="h-4 w-32" />
            </div>
            <USkeleton class="h-6 w-20 rounded-full" />
          </div>

          <div class="grid grid-cols-2 gap-6">
            <div class="space-y-2">
              <h4 class="font-medium">Original Card</h4>
              <div class="bg-slate-800 rounded p-3 border-2 border-gray-600">
                <USkeleton class="h-5 w-full" />
                <USkeleton class="h-5 w-3/4 mt-2" />
              </div>
              <div class="text-xs text-gray-400">
                <USkeleton class="h-3 w-48" />
              </div>
            </div>

            <div class="space-y-2">
              <h4 class="font-medium">Similar Card</h4>
              <div class="bg-slate-800 rounded p-3 border-2 border-gray-600">
                <USkeleton class="h-5 w-full" />
                <USkeleton class="h-5 w-3/4 mt-2" />
              </div>
              <div class="text-xs text-gray-400">
                <USkeleton class="h-3 w-48" />
              </div>
            </div>
          </div>

          <div class="flex justify-center mt-6 w-full">
            <USkeleton class="h-10 w-full rounded" />
          </div>
        </div>
      </div>
      <div
        v-else-if="selectedCard && similarCards.length > 0"
        class="space-y-6"
      >
        <div class="text-sm text-gray-400 mb-4">
          Select which card to keep and which to delete. Cards with higher
          similarity scores are more likely to be duplicates.
        </div>

        <div
          v-for="similarCard in similarCards"
          :key="similarCard.$id"
          class="border border-gray-700 rounded-lg p-4"
        >
          <div class="flex justify-between items-start mb-4">
            <div class="text-sm text-gray-400">
              Similarity:
              <span class="font-bold text-info-400"
                >{{ similarCard.similarityScore }}%</span
              >
            </div>
            <UBadge color="info" variant="subtle">{{
              similarCard.pack
            }}</UBadge>
          </div>

          <div class="grid grid-cols-2 gap-6">
            <!-- Original Card -->
            <div class="space-y-2">
              <h4 class="font-medium">Original Card</h4>
              <div
                class="bg-slate-800 rounded p-3 text-sm font-mono text-white cursor-pointer border-2"
                :class="
                  cardToKeep === 'original'
                    ? 'border-green-500'
                    : 'border-red-500'
                "
                @click="cardToKeep = 'original'"
              >
                {{ selectedCard.text }}
              </div>
              <div class="text-xs text-gray-400">
                Pack: {{ selectedCard.pack }} | ID: {{ selectedCard.$id }}
              </div>
            </div>

            <!-- Similar Card -->
            <div class="space-y-2">
              <h4 class="font-medium">Similar Card</h4>
              <div
                class="bg-slate-800 rounded p-3 text-sm font-mono text-white cursor-pointer border-2"
                :class="
                  cardToKeep === 'similar'
                    ? 'border-green-500'
                    : 'border-red-500'
                "
                @click="cardToKeep = 'similar'"
              >
                {{ similarCard.text }}
              </div>
              <div class="text-xs text-gray-400">
                Pack: {{ similarCard.pack }} | ID: {{ similarCard.$id }}
              </div>
            </div>
          </div>

          <div class="flex justify-center mt-6 w-full">
            <UButton
              color="error"
              @click="handleAction(similarCard)"
              :loading="loading"
              class="w-full"
              :disabled="!cardToKeep"
            >
              Delete
              {{ cardToKeep === "original" ? "Similar" : "Original" }} Card
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
          Showing {{ similarCards.length }} similar cards
        </div>
        <UButton
          color="neutral"
          variant="soft"
          @click="$emit('update:modelValue', false)"
        >
          Close
        </UButton>
      </div>
    </template>
  </UModal>
</template>
