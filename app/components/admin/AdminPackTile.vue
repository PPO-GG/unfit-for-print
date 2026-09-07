<script setup lang="ts">
/**
 * One pack as a tile rather than a row of icons.
 *
 * The colour stripe and icon come from `card_packs` and are the attachment
 * point for the future pack builder — adding foil or a treatment later means
 * extending this tile, not designing a new screen.
 */
import { computed, ref, nextTick } from "vue";
import type { AdminPackStat } from "~/composables/useAdminPackStats";
import type { CardPackMeta } from "~/types/cardPack";

const props = defineProps<{
  pack: AdminPackStat;
  meta?: CardPackMeta | null;
  isDefault?: boolean;
  selected?: boolean;
}>();

const emit = defineEmits<{ open: []; "toggle-select": []; rename: [string] }>();

const title = computed(() => props.meta?.displayName || props.pack.name);
const total = computed(() => props.pack.black.total + props.pack.white.total);
const allInactive = computed(
  () => props.pack.black.active + props.pack.white.active === 0,
);

const editing = ref(false);
const draft = ref("");
const inputEl = ref<HTMLInputElement | null>(null);

async function startRename() {
  draft.value = props.pack.name;
  editing.value = true;
  await nextTick();
  inputEl.value?.focus();
}

/**
 * Reached from both `@keydown.enter` and `@blur`, and Chrome fires `blur` when
 * a focused element is removed from the DOM — so Enter re-enters this via the
 * blur its own `editing = false` causes (two racing renames), and Escape,
 * which only closes the editor, used to commit whatever had been typed. The
 * re-entrancy guard is what makes both correct: once the editor is closed,
 * there is nothing left to commit.
 */
function commitRename() {
  if (!editing.value) return;
  const next = draft.value.trim();
  editing.value = false;
  if (next && next !== props.pack.name) emit("rename", next);
}
</script>

<template>
  <div
    class="relative rounded-lg border bg-slate-800/70 p-3 overflow-hidden transition-colors"
    :class="[
      selected ? 'border-primary-500 ring-1 ring-primary-500' : 'border-slate-700',
      allInactive ? 'opacity-60' : '',
    ]"
  >
    <span
      class="absolute inset-y-0 left-0 w-1"
      :style="{ background: meta?.color || '#475569' }"
    />

    <button
      type="button"
      data-testid="pack-select"
      class="absolute top-2 right-2 z-10 w-3.5 h-3.5 rounded border"
      :class="selected ? 'bg-primary-600 border-primary-400' : 'border-slate-500 bg-slate-900/80'"
      :aria-pressed="selected"
      aria-label="Select pack"
      @click.stop="emit('toggle-select')"
    />

    <div class="pl-2">
      <input
        v-if="editing"
        ref="inputEl"
        v-model="draft"
        data-testid="pack-rename"
        class="relative z-10 w-full bg-slate-900 border border-primary-500 rounded px-1 text-sm text-white"
        @keydown.enter="commitRename"
        @keydown.esc="editing = false"
        @blur="commitRename"
      />
      <h3
        v-else
        data-testid="pack-name"
        class="relative z-10 text-sm font-semibold text-slate-100 truncate pr-5"
        @dblclick.stop="startRename"
      >
        <span v-if="meta?.icon" class="mr-1">{{ meta.icon }}</span>{{ title }}
      </h3>

      <div class="flex h-1 rounded overflow-hidden bg-slate-900 my-2">
        <div class="bg-slate-500" :style="{ flexGrow: pack.black.total }" />
        <div class="bg-slate-300" :style="{ flexGrow: pack.white.total }" />
      </div>

      <p class="text-[10px] text-slate-400">
        {{ pack.black.total.toLocaleString() }} black ·
        {{ pack.white.total.toLocaleString() }} white
      </p>

      <div class="flex flex-wrap gap-1 mt-2">
        <span v-if="isDefault" class="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-900/60 text-amber-200">★ default</span>
        <span v-if="meta?.official" class="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300">official</span>
        <span v-if="meta?.nsfw" class="text-[9px] px-1.5 py-0.5 rounded-full bg-red-950 text-red-300">nsfw</span>
        <span v-if="allInactive" class="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400">all inactive</span>
      </div>

      <button
        type="button"
        data-testid="pack-open"
        class="absolute inset-0 z-0"
        aria-label="Open pack"
        @click="emit('open')"
      />
    </div>
  </div>
</template>
