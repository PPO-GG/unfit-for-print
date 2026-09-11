<script setup lang="ts">
/**
 * New decoration = a name plus a starting point. Submitting creates a hidden
 * row and the page navigates to the studio, so there's no unsaved "new" state.
 */
import { computed, ref, watch } from "vue";
import type { DecorationCatalogEntry } from "~/types/decoration";
import { STARTERS, type StarterId } from "#shared/decorationPresets";
import { slugify } from "#shared/decorationAssets";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ catalog: DecorationCatalogEntry[]; creating?: boolean }>();
const emit = defineEmits<{ create: [{ name: string; slug?: string; starter?: StarterId; copyFrom?: string }] }>();

const name = ref("");
/** Optional explicit id; the server still slugifies it and appends -2 on collision. */
const customSlug = ref("");
const choice = ref<StarterId | "copy">("blank");
const copyFrom = ref<string | undefined>();
const nameError = ref("");

watch(
  open,
  (isOpen) => {
    if (!isOpen) return;
    name.value = "";
    customSlug.value = "";
    choice.value = "blank";
    copyFrom.value = props.catalog[0]?.decorationId;
    nameError.value = "";
  },
  { immediate: true },
);
watch(name, () => (nameError.value = ""));

const slug = computed(() => slugify(customSlug.value || name.value));
const copyItems = computed(() => props.catalog.map((d) => ({ label: d.name, value: d.decorationId })));
const options = computed(() => [
  ...Object.entries(STARTERS).map(([id, s]) => ({ id: id as StarterId | "copy", label: s.label })),
  ...(props.catalog.length ? [{ id: "copy" as const, label: "Copy existing" }] : []),
]);

function submit() {
  const trimmed = name.value.trim();
  if (!trimmed) {
    nameError.value = "Enter a name";
    return;
  }
  const custom = customSlug.value.trim() ? { slug: customSlug.value.trim() } : {};
  if (choice.value === "copy") {
    if (copyFrom.value) emit("create", { name: trimmed, copyFrom: copyFrom.value, ...custom });
    return;
  }
  emit("create", { name: trimmed, starter: choice.value, ...custom });
}
</script>

<template>
  <UModal v-model:open="open">
    <template #content>
      <form class="flex flex-col gap-4 p-6" @submit.prevent="submit">
        <h2 class="text-lg font-bold">New decoration</h2>
        <label class="flex flex-col gap-1 text-xs text-slate-400">Name
          <UInput v-model="name" data-testid="new-name" placeholder="Gold Ring" autofocus />
        </label>
        <p v-if="nameError" data-testid="new-name-error" class="text-sm text-red-400">{{ nameError }}</p>
        <label class="flex flex-col gap-1 text-xs text-slate-400">Id (optional; fixed after creation)
          <UInput v-model="customSlug" data-testid="new-slug" class="font-mono" :placeholder="slugify(name) || 'gold-ring'" />
        </label>
        <p v-if="name || customSlug" class="font-mono text-xs text-slate-500">Will be saved as: {{ slug }} (gets -2 if taken)</p>

        <div class="flex flex-col gap-2">
          <span class="text-xs text-slate-400">Start from</span>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="o in options"
              :key="o.id"
              type="button"
              :data-testid="`starter-${o.id}`"
              class="rounded-lg border px-3 py-2 text-left text-sm"
              :class="choice === o.id ? 'border-primary-500 bg-primary-500/10' : 'border-slate-700 hover:border-slate-500'"
              @click="choice = o.id"
            >
              {{ o.label }}
            </button>
          </div>
          <USelect v-if="choice === 'copy'" v-model="copyFrom" data-testid="new-copy-from" :items="copyItems" />
        </div>

        <div class="flex justify-end gap-2">
          <UButton type="button" variant="ghost" color="neutral" @click="open = false">Cancel</UButton>
          <UButton data-testid="new-create" type="submit" :loading="creating" @click.prevent="submit">Create</UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
