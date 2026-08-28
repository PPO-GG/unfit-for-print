<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type { CardAttachmentConfig } from "~/types/card";
import { DEFAULT_CARD_ATTACHMENT } from "~/utils/cardAttachmentDefaults";
import { buildCardPayload } from "~/utils/cardFormPayload";
import { getCardImageUrl } from "~/utils/cardImage";

const props = defineProps<{
  modelValue: boolean;
  availablePacks: string[];
}>();

const emit = defineEmits(["update:modelValue", "add"]);
const { $activityFetch } = useNuxtApp();

const newSingleCardText = ref("");
const newSingleCardPack = ref("");
const newSingleCardType = ref<"white" | "black">("white");
const newSingleCardPicks = ref(1);
const mode = ref<"text" | "image">("text");
const imageFileId = ref<string | null>(null);
const imageFormat = ref<string | null>(null);
const attachment = reactive<CardAttachmentConfig>({ ...DEFAULT_CARD_ATTACHMENT });
const uploading = ref(false);

const previewImageUrl = computed(() =>
  imageFileId.value ? getCardImageUrl(imageFileId.value) : null,
);

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      newSingleCardText.value = "";
      newSingleCardPack.value = "";
      newSingleCardType.value = "white";
      newSingleCardPicks.value = 1;
      mode.value = "text";
      imageFileId.value = null;
      imageFormat.value = null;
      Object.assign(attachment, DEFAULT_CARD_ATTACHMENT);
    }
  },
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

const addSingleCard = () => {
  if (!newSingleCardPack.value) return;
  if (mode.value === "text" && !newSingleCardText.value.trim()) return;
  if (mode.value === "image" && !imageFileId.value) return;

  const payload = buildCardPayload({
    type: newSingleCardType.value,
    pack: newSingleCardPack.value,
    mode: mode.value,
    text: newSingleCardText.value,
    pick: newSingleCardType.value === "black" ? Number(newSingleCardPicks.value) || 1 : undefined,
    imageFileId: imageFileId.value,
    imageFormat: imageFormat.value,
    attachment: { ...attachment },
  });

  emit("add", payload);
};
</script>

<template>
  <UModal :open="modelValue" @update:open="$emit('update:modelValue', $event)">
    <template #header>
      <h3 class="text-lg font-medium">Add Single Card</h3>
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
          v-model="newSingleCardText"
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
        <UButton color="neutral" variant="soft" @click="$emit('update:modelValue', false)">
          Cancel
        </UButton>
        <UButton
          color="success"
          @click="addSingleCard"
          :disabled="!newSingleCardPack || (mode === 'text' ? !newSingleCardText.trim() : !imageFileId)"
        >
          Add Card
        </UButton>
      </div>
    </template>
  </UModal>
</template>
