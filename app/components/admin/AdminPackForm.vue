<script setup lang="ts">
/**
 * Edits one pack's metadata row. The row is optional — a pack with no row is
 * the normal case — so the form opens on blank defaults and the POST upserts.
 *
 * Empty strings are sent as null so clearing a field actually clears it,
 * rather than storing "" and having every reader test for both.
 */
import { ref, watch } from "vue";
import { useNotifications } from "~/composables/useNotifications";
import type { CardPackMeta } from "~/types/cardPack";

const props = defineProps<{
  pack: string;
  meta: CardPackMeta | null;
}>();

const emit = defineEmits<{
  saved: [CardPackMeta];
}>();

const { $activityFetch } = useNuxtApp();
const { notify } = useNotifications();

const saving = ref(false);

const blank = () => ({
  displayName: "",
  description: "",
  icon: "",
  color: "",
  series: "",
  sortOrder: 0,
  official: false,
  nsfw: false,
});

const form = ref(blank());

function seed() {
  form.value = props.meta
    ? {
        displayName: props.meta.displayName ?? "",
        description: props.meta.description ?? "",
        icon: props.meta.icon ?? "",
        color: props.meta.color ?? "",
        series: props.meta.series ?? "",
        sortOrder: props.meta.sortOrder ?? 0,
        official: props.meta.official ?? false,
        nsfw: props.meta.nsfw ?? false,
      }
    : blank();
}
seed();
// Also on `pack` changing: switching packs discards whatever was mid-edit
// rather than resuming it against the newly selected pack.
watch(
  () => [props.pack, props.meta],
  () => seed(),
);

const orNull = (v: string) => (v.trim() ? v.trim() : null);

async function save() {
  saving.value = true;
  try {
    const row = await $activityFetch<CardPackMeta>("/api/admin/cards/pack-meta", {
      method: "POST",
      body: {
        pack: props.pack,
        displayName: orNull(form.value.displayName),
        description: orNull(form.value.description),
        icon: orNull(form.value.icon),
        color: orNull(form.value.color),
        series: orNull(form.value.series),
        sortOrder: Number(form.value.sortOrder) || 0,
        official: form.value.official,
        nsfw: form.value.nsfw,
      },
    });
    emit("saved", row);
  } catch {
    notify({
      title: "Save Failed",
      description: `Could not save details for "${props.pack}".`,
      color: "error",
    });
  } finally {
    saving.value = false;
  }
}

defineExpose({ form, save });
</script>

<template>
  <div class="flex flex-col gap-4">
    <UFormField label="Display name">
      <UInput v-model="form.displayName" class="w-full" placeholder="Shown instead of the raw pack name" />
    </UFormField>

    <UFormField label="Series / brand">
      <UInput v-model="form.series" class="w-full" placeholder="e.g. Cards Against Humanity" />
    </UFormField>

    <UFormField label="Description">
      <UTextarea v-model="form.description" class="w-full" :rows="3" placeholder="What is in this pack?" />
    </UFormField>

    <div class="grid grid-cols-2 gap-3">
      <UFormField label="Icon">
        <UInput v-model="form.icon" class="w-full" placeholder="🎴" />
      </UFormField>
      <UFormField label="Accent colour">
        <UInput v-model="form.color" class="w-full" placeholder="#3b82f6" />
      </UFormField>
    </div>

    <UFormField label="Sort order">
      <UInput v-model="form.sortOrder" type="number" class="w-full" />
    </UFormField>

    <div class="flex items-center justify-between">
      <USwitch v-model="form.official" label="Official pack" />
    </div>

    <div class="flex items-center justify-between">
      <USwitch v-model="form.nsfw" label="NSFW" />
    </div>

    <div class="flex justify-end">
      <UButton color="primary" :loading="saving" @click="save">Save details</UButton>
    </div>
  </div>
</template>
