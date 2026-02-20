<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  modelValue: boolean;
  card: any;
  cardType: string;
}>();

const emit = defineEmits(["update:modelValue", "save"]);

const newCardText = ref("");
const editingCardPicks = ref(1);

watch(
  () => props.card,
  (newCard) => {
    if (newCard) {
      newCardText.value = newCard.text;
      if (props.cardType === "black" && newCard.pick) {
        editingCardPicks.value = newCard.pick;
      } else {
        editingCardPicks.value = 1; // Default value
      }
    }
  },
  { immediate: true },
);

const saveCardEdit = () => {
  if (!props.card || !newCardText.value.trim()) {
    return;
  }

  const updateData: any = {
    $id: props.card.$id,
    text: newCardText.value.trim(),
  };

  if (props.cardType === "black") {
    updateData.pick = parseInt(editingCardPicks.value.toString()) || 1;
  }

  emit("save", updateData);
};
</script>

<template>
  <UModal :open="modelValue" @update:open="$emit('update:modelValue', $event)">
    <template #header>
      <h3 class="text-lg font-medium">Edit Card</h3>
    </template>
    <template #body>
      <div class="space-y-4">
        <UTextarea
          v-model="newCardText"
          placeholder="Enter card text..."
          class="w-full"
          :rows="5"
          autofocus
        />
        <div v-if="cardType === 'black'">
          <label class="block text-sm font-medium mb-1">Number of Picks</label>
          <UInput
            v-model="editingCardPicks"
            type="number"
            min="1"
            max="3"
            placeholder="Number of cards to pick"
            class="w-full"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="soft"
          @click="$emit('update:modelValue', false)"
        >
          Cancel
        </UButton>
        <UButton
          color="primary"
          @click="saveCardEdit"
          :disabled="!newCardText.trim()"
        >
          Save Changes
        </UButton>
      </div>
    </template>
  </UModal>
</template>
