<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type { CardAttachmentConfig } from "~/types/card";
import { DEFAULT_CARD_ATTACHMENT } from "~/utils/cardAttachmentDefaults";
import { buildCardPayload } from "~/utils/cardFormPayload";
import { getCardImageUrl } from "~/utils/cardImage";

const props = defineProps<{
  modelValue: boolean;
  card: any;
  cardType: string;
}>();

const emit = defineEmits(["update:modelValue", "save"]);
const { $activityFetch } = useNuxtApp();

const newCardText = ref("");
const editingCardPicks = ref(1);
const mode = ref<"text" | "image">("text");
const imageFileId = ref<string | null>(null);
const imageFormat = ref<string | null>(null);
const attachment = reactive<CardAttachmentConfig>({ ...DEFAULT_CARD_ATTACHMENT });
const uploading = ref(false);

const previewImageUrl = computed(() =>
  imageFileId.value ? getCardImageUrl(imageFileId.value) : null,
);

watch(
  () => props.card,
  (newCard) => {
    if (!newCard) return;
    newCardText.value = newCard.text || "";
    if (props.cardType === "black" && newCard.pick) {
      editingCardPicks.value = newCard.pick;
    } else {
      editingCardPicks.value = 1;
    }
    if (newCard.imageKey) {
      mode.value = "image";
      imageFileId.value = newCard.imageKey;
      imageFormat.value = newCard.imageFormat || null;
      Object.assign(attachment, newCard.attachment || DEFAULT_CARD_ATTACHMENT);
    } else {
      mode.value = "text";
      imageFileId.value = null;
      imageFormat.value = null;
      Object.assign(attachment, DEFAULT_CARD_ATTACHMENT);
    }
  },
  { immediate: true },
);

async function uploadImage(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  uploading.value = true;
  try {
    const form = new FormData();
    form.append("file", file);
    const result = await $activityFetch<{ fileId: string; imageFormat: string }>(
      "/api/admin/cards/images/upload",
      { method: "POST", body: form },
    );
    imageFileId.value = result.fileId;
    imageFormat.value = result.imageFormat;
  } catch (err: any) {
    alert(`Upload failed: ${err.data?.statusMessage || err.message || err}`);
  }
  uploading.value = false;
  if (input) input.value = "";
}

const saveCardEdit = () => {
  if (!props.card) return;
  if (mode.value === "text" && !newCardText.value.trim()) return;
  if (mode.value === "image" && !imageFileId.value) return;

  const payload = buildCardPayload({
    type: props.cardType as "white" | "black",
    mode: mode.value,
    text: newCardText.value,
    pick: props.cardType === "black" ? Number(editingCardPicks.value) || 1 : undefined,
    imageFileId: imageFileId.value,
    imageFormat: imageFormat.value,
    attachment: { ...attachment },
  });

  emit("save", { id: props.card.id, ...payload });
};
</script>

<template>
  <UModal :open="modelValue" @update:open="$emit('update:modelValue', $event)">
    <template #header>
      <h3 class="text-lg font-medium">Edit Card</h3>
    </template>
    <template #body>
      <div class="space-y-4">
        <div class="flex gap-2">
          <UButton :variant="mode === 'text' ? 'solid' : 'soft'" size="sm" @click="mode = 'text'">
            Text
          </UButton>
          <UButton :variant="mode === 'image' ? 'solid' : 'soft'" size="sm" @click="mode = 'image'">
            Image
          </UButton>
        </div>

        <UTextarea
          v-if="mode === 'text'"
          v-model="newCardText"
          placeholder="Enter card text..."
          class="w-full"
          :rows="5"
          autofocus
        />

        <div v-else class="space-y-3">
          <input type="file" accept="image/png,image/webp,image/jpeg" @change="uploadImage" />
          <p v-if="uploading" class="text-sm text-slate-400">Uploading…</p>
          <div v-if="previewImageUrl" class="space-y-2">
            <img :src="previewImageUrl" class="w-32 aspect-[3/4] object-cover rounded" alt="" />
            <div class="grid grid-cols-3 gap-2 text-sm">
              <label class="flex flex-col gap-1">
                Offset X
                <UInputNumber v-model="attachment.offsetX" :step="0.05" :min="-0.5" :max="0.5" />
              </label>
              <label class="flex flex-col gap-1">
                Offset Y
                <UInputNumber v-model="attachment.offsetY" :step="0.05" :min="-0.5" :max="0.5" />
              </label>
              <label class="flex flex-col gap-1">
                Scale
                <UInputNumber v-model="attachment.scale" :step="0.1" :min="1" :max="3" />
              </label>
            </div>
          </div>
        </div>

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
        <UButton color="neutral" variant="soft" @click="$emit('update:modelValue', false)">
          Cancel
        </UButton>
        <UButton
          color="primary"
          @click="saveCardEdit"
          :disabled="mode === 'text' ? !newCardText.trim() : !imageFileId"
        >
          Save Changes
        </UButton>
      </div>
    </template>
  </UModal>
</template>
