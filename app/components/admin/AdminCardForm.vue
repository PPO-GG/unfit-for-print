<script setup lang="ts">
/**
 * Inspector state ② — one card, edited in place. This replaces the edit
 * modal: the grid stays visible, so you keep your position in a long scan.
 *
 * `draft` is local and re-seeds whenever a different card is inspected, so
 * clicking away from an unsaved edit discards it rather than leaking it onto
 * the next card.
 */
import { reactive, ref, watch, computed } from "vue";
import type { AdminCard } from "~/composables/useAdminCardList";
import { cardRate, packAverage, MIN_PLAYS_FOR_RATE } from "~/composables/useAdminCardStats";
import { getCardImageUrl } from "~/utils/cardImage";

const props = defineProps<{
  card: AdminCard;
  packs: string[];
  packCards?: AdminCard[];
  saving?: boolean;
}>();

/**
 * An image card has no text to edit — showing it an empty textarea invited an
 * edit that /api/admin/cards/edit turns into "this card is text now", nulling
 * imageKey/imageFormat/attachment. Show the image instead; the page passes the
 * existing image fields back through on save so they survive a pick change.
 * Editing the attachment itself is a follow-up.
 */
const hasImage = computed(() => Boolean(props.card.imageKey));
const imageUrl = computed(() =>
  props.card.imageKey ? getCardImageUrl(props.card.imageKey) : "",
);

const rate = computed(() => cardRate(props.card));
const average = computed(() => packAverage(props.packCards ?? [], rate.value.kind));
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

const emit = defineEmits<{
  save: [{ text: string; pick?: number }];
  move: [string];
  "toggle-active": [];
  delete: [];
}>();

const draft = reactive({ text: props.card.text ?? "", pick: props.card.pick ?? 1 });

// What we last emitted via `save`, so a blur that follows a Ctrl/Cmd+Enter
// save can be recognized as a repeat even though the parent's save is async
// and props.card has not caught up yet (see below).
const lastEmitted = ref<{ text: string; pick?: number } | null>(null);

watch(
  () => props.card.id,
  () => {
    draft.text = props.card.text ?? "";
    draft.pick = props.card.pick ?? 1;
    lastEmitted.value = null;
  },
);

function save() {
  const text = draft.text.trim();
  // An image card legitimately has no text, and its `pick` is still editable.
  if (!text && !hasImage.value) return;

  const pick = props.card.type === "black" ? Number(draft.pick) || 1 : undefined;
  // Both blur and Ctrl/Cmd+Enter reach this. Without a dirty check, saving
  // with the keyboard and then moving focus away sends the same edit twice.
  // The parent's save is async, so props.card may still hold the pre-save
  // values when the second call lands — comparing against lastEmitted (what
  // we ourselves just sent) catches that case; comparing against props.card
  // is kept as a cheap short-circuit for the common "nothing changed" case.
  const payload = { text, pick };
  const unchangedFromCard =
    text === (props.card.text ?? "").trim() &&
    pick === (props.card.type === "black" ? props.card.pick ?? 1 : undefined);
  const unchangedFromLastEmitted =
    lastEmitted.value !== null &&
    lastEmitted.value.text === payload.text &&
    lastEmitted.value.pick === payload.pick;
  if (unchangedFromCard || unchangedFromLastEmitted) return;

  lastEmitted.value = payload;
  emit("save", payload);
}

defineExpose({ draft, save });
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="text-[10px] uppercase tracking-wider text-slate-500">
      {{ card.type }} card
    </p>

    <UFormField v-if="hasImage" label="Image">
      <img
        data-testid="card-image"
        class="w-full rounded border border-slate-700 object-contain bg-slate-950"
        :src="imageUrl"
        alt=""
      />
      <p class="text-[10px] text-slate-500 mt-1">
        Image cards have no text. Re-upload to replace the picture.
      </p>
    </UFormField>
    <UFormField v-else label="Text">
      <UTextarea
        v-model="draft.text"
        :rows="4"
        class="w-full"
        @blur="save"
        @keydown.meta.enter="save"
        @keydown.ctrl.enter="save"
      />
    </UFormField>

    <UFormField v-if="card.type === 'black'" label="Pick">
      <UInput v-model="draft.pick" type="number" class="w-full" @blur="save" />
    </UFormField>

    <UFormField label="Pack">
      <AdminPackPicker
        :model-value="card.pack ?? ''"
        :packs="packs"
        label=""
        @update:model-value="emit('move', $event)"
      />
    </UFormField>

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
          <span :class="rate.kind === 'skip' ? 'text-red-400' : 'text-green-400'" class="font-semibold">
            {{ pct(rate.value) }}
          </span>
        </div>
        <p v-if="average !== null" class="text-[10px] text-slate-500">
          pack average {{ pct(average) }}
        </p>
      </template>
    </div>

    <div class="flex gap-2 pt-1">
      <UButton
        size="xs"
        class="flex-1"
        :color="card.active ? 'warning' : 'success'"
        variant="soft"
        :loading="saving"
        @click="emit('toggle-active')"
      >
        {{ card.active ? "Deactivate" : "Activate" }}
      </UButton>
      <UButton size="xs" color="error" variant="ghost" @click="emit('delete')">
        Delete
      </UButton>
    </div>
  </div>
</template>
