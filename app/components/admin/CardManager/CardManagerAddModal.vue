<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  modelValue: boolean;
  availablePacks: string[];
}>();

const emit = defineEmits(["update:modelValue", "add"]);

const newSingleCardText = ref("");
const newSingleCardPack = ref("");
const newSingleCardType = ref<"white" | "black">("white");
const newSingleCardPicks = ref(1);

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      newSingleCardText.value = "";
      newSingleCardPack.value = "";
      newSingleCardType.value = "white";
      newSingleCardPicks.value = 1;
    }
  },
);

const addSingleCard = () => {
  if (!newSingleCardText.value.trim() || !newSingleCardPack.value) {
    return;
  }

  const cardData: any = {
    text: newSingleCardText.value.trim(),
    pack: newSingleCardPack.value,
    type: newSingleCardType.value,
  };

  if (newSingleCardType.value === "black") {
    cardData.pick = parseInt(newSingleCardPicks.value.toString()) || 1;
  }

  emit("add", cardData);
};
</script>

<template>
  <UModal :open="modelValue" @update:open="$emit('update:modelValue', $event)">
    <template #header>
      <h3 class="text-lg font-medium">Add Single Card</h3>
    </template>
    <template #body>
      <div class="space-y-4">
        <UTextarea
          v-model="newSingleCardText"
          placeholder="Enter card text..."
          class="w-full"
          :rows="5"
          autofocus
        />
        <div>
          <label class="block text-sm font-medium mb-1">Select Pack</label>
          <div class="flex gap-2">
            <USelectMenu
              v-model="newSingleCardPack"
              :items="availablePacks"
              placeholder="Select existing pack"
              class="flex-1"
            />
            <UInput
              v-if="!availablePacks.includes(newSingleCardPack)"
              v-model="newSingleCardPack"
              placeholder="Or enter new pack name"
              class="flex-1"
            />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Card Type</label>
          <USelectMenu
            v-model="newSingleCardType"
            :items="['black', 'white']"
            placeholder="Select card type"
            class="w-full"
          />
        </div>
        <div v-if="newSingleCardType === 'black'">
          <label class="block text-sm font-medium mb-1">Number of Picks</label>
          <UInput
            v-model="newSingleCardPicks"
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
          color="success"
          @click="addSingleCard"
          :disabled="!newSingleCardText.trim() || !newSingleCardPack"
        >
          Add Card
        </UButton>
      </div>
    </template>
  </UModal>
</template>
