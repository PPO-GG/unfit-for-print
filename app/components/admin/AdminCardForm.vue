<script setup lang="ts">
/**
 * One card, edited in the inspector. Nothing saves until Save or Ctrl/⌘+Enter;
 * `dirty` lets the page ask before a selection change throws an edit away.
 */
import { computed, reactive, ref, watch } from "vue";
import type { AdminCard } from "~/types/adminCard";
import { cardRate, packAverage, MIN_PLAYS_FOR_RATE } from "~/composables/useAdminCardStats";
import { getCardImageUrl } from "~/utils/cardImage";

const props = defineProps<{
  card: AdminCard;
  packs: string[];
  packCards?: AdminCard[];
  saving?: boolean;
}>();

const emit = defineEmits<{
  save: [{ text: string; pick?: number; pack?: string }];
  "toggle-active": [];
  delete: [];
}>();

const hasImage = computed(() => Boolean(props.card.imageKey));
const imageUrl = computed(() => (props.card.imageKey ? getCardImageUrl(props.card.imageKey) : ""));
const rate = computed(() => cardRate(props.card));
const average = computed(() => packAverage(props.packCards ?? [], rate.value.kind));
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

const fromCard = () => ({
  text: props.card.text ?? "",
  pick: props.card.pick ?? 1,
  pack: props.card.pack ?? "",
});

// `base` is what the draft was seeded from. Dirtiness is measured against it,
// not against the live prop: after a reload the prop already holds new values,
// and comparing to those would mark an untouched draft dirty and freeze it.
const base = ref(fromCard());
const draft = reactive(fromCard());

const dirty = computed(
  () =>
    draft.text.trim() !== base.value.text.trim() ||
    (props.card.type === "black" && Number(draft.pick) !== base.value.pick) ||
    draft.pack.trim() !== base.value.pack,
);

function revert() {
  base.value = fromCard();
  Object.assign(draft, base.value);
}

watch(
  () => [props.card.id, props.card.text, props.card.pick, props.card.pack] as const,
  ([id], [prevId]) => {
    if (id !== prevId || !dirty.value) revert();
  },
);

function save() {
  if (!dirty.value) return;
  const text = draft.text.trim();
  if (!text && !hasImage.value) return;
  const pack = draft.pack.trim();
  emit("save", {
    text,
    pick: props.card.type === "black" ? Number(draft.pick) || 1 : undefined,
    pack: pack && pack !== base.value.pack ? pack : undefined,
  });
}

const textArea = ref<{ $el: HTMLElement } | null>(null);
function focusText() {
  textArea.value?.$el?.querySelector?.("textarea")?.focus();
}

defineExpose({ draft, dirty, save, revert, focusText });
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="text-[10px] uppercase tracking-wider text-slate-500">{{ card.type }} card</p>

    <UFormField v-if="hasImage" label="Image">
      <img data-testid="card-image" class="w-full rounded border border-slate-700 object-contain bg-slate-950" :src="imageUrl" alt="" />
      <p class="text-[10px] text-slate-500 mt-1">Image cards have no text. Re-upload to replace the picture.</p>
    </UFormField>
    <UFormField v-else label="Text">
      <UTextarea
        ref="textArea"
        v-model="draft.text"
        :rows="4"
        class="w-full"
        @keydown.meta.enter.prevent="save"
        @keydown.ctrl.enter.prevent="save"
      />
    </UFormField>

    <UFormField v-if="card.type === 'black'" label="Pick">
      <UInput v-model="draft.pick" type="number" class="w-full" @keydown.meta.enter.prevent="save" @keydown.ctrl.enter.prevent="save" />
    </UFormField>

    <UFormField label="Pack">
      <AdminPackPicker v-model="draft.pack" :packs="packs" label="" />
    </UFormField>

    <div class="flex gap-2">
      <UButton size="xs" color="primary" :disabled="!dirty" :loading="saving" data-testid="card-save" @click="save">
        Save
      </UButton>
      <UButton size="xs" variant="ghost" :disabled="!dirty" @click="revert">Revert</UButton>
    </div>

    <div class="pt-1">
      <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Performance</p>
      <div class="flex justify-between text-xs py-0.5 border-b border-slate-800">
        <span class="text-slate-400">Times played</span>
        <span class="text-slate-100 font-semibold">{{ (card.timesPlayed ?? 0).toLocaleString() }}</span>
      </div>
      <div class="flex justify-between text-xs py-0.5 border-b border-slate-800">
        <span class="text-slate-400">{{ rate.kind === "skip" ? "Times skipped" : "Times won" }}</span>
        <span class="text-slate-100 font-semibold">
          {{ ((rate.kind === "skip" ? card.timesSkipped : card.timesWon) ?? 0).toLocaleString() }}
        </span>
      </div>
      <p v-if="rate.value === null" class="text-[10px] text-slate-500 mt-1.5">
        Not enough plays yet — a rate needs {{ MIN_PLAYS_FOR_RATE }}.
      </p>
      <template v-else>
        <div class="flex justify-between text-xs py-0.5">
          <span class="text-slate-400">{{ rate.kind === "skip" ? "Skip rate" : "Win rate" }}</span>
          <span :class="rate.kind === 'skip' ? 'text-red-400' : 'text-green-400'" class="font-semibold">{{ pct(rate.value) }}</span>
        </div>
        <p v-if="average !== null" class="text-[10px] text-slate-500">pack average {{ pct(average) }}</p>
      </template>
    </div>

    <div class="flex gap-2 pt-1">
      <UButton size="xs" class="flex-1" :color="card.active ? 'warning' : 'success'" variant="soft" @click="emit('toggle-active')">
        {{ card.active ? "Disable" : "Enable" }}
      </UButton>
      <UButton size="xs" color="error" variant="ghost" @click="emit('delete')">Delete</UButton>
    </div>
  </div>
</template>
