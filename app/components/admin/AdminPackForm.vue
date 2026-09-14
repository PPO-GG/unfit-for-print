<script setup lang="ts">
/**
 * One pack, edited in the inspector: its one name (a real rename — the id
 * stays, so lobbies keep it), series, presentation fields, and the default
 * and enabled switches. Nothing saves until Save or Ctrl/⌘+Enter.
 */
import { computed, ref, watch } from "vue";
import type { AdminPack } from "~/types/adminCard";
import { draftsEqual, packToDraft, type PackDraft } from "~/utils/packDraft";
import { splitPackName } from "~/utils/packName";
import { looksShouted, normalizePackText } from "#shared/packMetaText";

const props = defineProps<{
  pack: AdminPack;
  seriesPrefix?: string;
  saving?: boolean;
}>();

const emit = defineEmits<{ save: [PackDraft]; delete: [] }>();

// Measured against what the draft was seeded from, not the live prop — see
// AdminCardForm for why comparing to a freshly reloaded prop would misfire.
const base = ref<PackDraft>(packToDraft(props.pack));
const draft = ref<PackDraft>(packToDraft(props.pack));
const dirty = computed(() => !draftsEqual(draft.value, base.value));

const revert = () => {
  base.value = packToDraft(props.pack);
  draft.value = { ...base.value };
};

watch(
  () => props.pack,
  (next, prev) => {
    if (!prev || next.id !== prev.id || !dirty.value) revert();
  },
);

// The guess the old tiles showed, offered rather than pre-filled: a
// pre-filled field would make every untouched pack look edited.
const suggestedSeries = computed(() =>
  splitPackName(props.pack.name, props.seriesPrefix ?? "").series.replace(/[:\s]+$/, ""),
);
const canSuggest = computed(() => !draft.value.series && Boolean(suggestedSeries.value));

const shouted = computed(() =>
  (["name", "series"] as const).filter((k) => looksShouted(draft.value[k])),
);

function save() {
  if (!dirty.value) return;
  draft.value.name = normalizePackText(draft.value.name) ?? "";
  draft.value.series = normalizePackText(draft.value.series) ?? "";
  if (!draft.value.name) return;
  emit("save", { ...draft.value });
}

const nameField = ref<{ $el: HTMLElement } | null>(null);
const focusName = () => nameField.value?.$el?.querySelector?.("input")?.focus();

defineExpose({ draft, dirty, save, revert, focusName });
</script>

<template>
  <div class="flex flex-col gap-3" @keydown.meta.enter.prevent="save" @keydown.ctrl.enter.prevent="save">
    <p class="text-[10px] uppercase tracking-wider text-slate-500">Pack</p>

    <UFormField label="Name">
      <UInput ref="nameField" v-model="draft.name" class="w-full" data-testid="pack-name-input" />
    </UFormField>

    <UFormField label="Series / brand">
      <UInput v-model="draft.series" class="w-full" :placeholder="suggestedSeries || 'e.g. Cards Against Humanity'" />
      <button
        v-if="canSuggest"
        type="button"
        data-testid="use-series-suggestion"
        class="mt-1 text-[11px] text-primary-300 hover:underline"
        @click="draft.series = suggestedSeries"
      >
        Use “{{ suggestedSeries }}”
      </button>
    </UFormField>

    <p v-if="shouted.length" data-testid="pack-shout-hint" class="-mt-1 text-xs text-amber-400/90">
      Type {{ shouted.length > 1 ? "these" : "this" }} the way you'd write it in a sentence — every screen
      uppercases pack names already, and stored caps can't be turned back into title case.
    </p>

    <UFormField label="Description">
      <UTextarea v-model="draft.description" class="w-full" :rows="3" placeholder="What is in this pack?" />
    </UFormField>

    <div class="grid grid-cols-2 gap-3">
      <UFormField label="Icon"><UInput v-model="draft.icon" class="w-full" placeholder="🎴" /></UFormField>
      <UFormField label="Accent colour"><UInput v-model="draft.color" class="w-full" placeholder="#3b82f6" /></UFormField>
    </div>

    <UFormField label="Sort order">
      <UInput v-model.number="draft.sortOrder" type="number" class="w-full" />
    </UFormField>

    <USwitch v-model="draft.official" label="Official pack" />
    <USwitch v-model="draft.nsfw" label="NSFW" />
    <USwitch v-model="draft.isDefault" label="Default for new lobbies" />
    <USwitch v-model="draft.active" label="Enabled" />

    <div class="flex gap-2 pt-1">
      <UButton size="xs" color="primary" :disabled="!dirty" :loading="saving" data-testid="pack-save" @click="save">Save</UButton>
      <UButton size="xs" variant="ghost" :disabled="!dirty" @click="revert">Revert</UButton>
      <span class="flex-1" />
      <UButton size="xs" color="error" variant="ghost" @click="emit('delete')">Delete pack</UButton>
    </div>
  </div>
</template>
