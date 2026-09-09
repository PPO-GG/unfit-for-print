<script setup lang="ts">
/**
 * One pack as a card, borrowing the game browser's `.lobby-card` treatment —
 * accent bar, hatched ground, hover lift — so the admin reads as part of the
 * same product.
 *
 * Two facts about the real data drive the layout. 106 of the 111 packs begin
 * "Cards Against Humanity:", so a single truncated line showed the same 23
 * characters on nearly every tile and cut off the part that identified it;
 * `seriesPrefix` splits that away so the distinguishing half gets the
 * headline. And `card_packs` is empty — every pack's colour, icon and
 * description are null — so the tile has to look right with no metadata at
 * all and simply grow into it. That is why the accent falls back to a hue
 * derived from the name rather than one flat slate across 111 cards.
 */
import { computed, ref, nextTick } from "vue";
import type { AdminPackStat } from "~/composables/useAdminPackStats";
import type { CardPackMeta } from "~/types/cardPack";
import { splitPackName, packAccent } from "~/utils/packName";

const props = defineProps<{
  pack: AdminPackStat;
  meta?: CardPackMeta | null;
  isDefault?: boolean;
  selected?: boolean;
  /** Shared series prefix across the loaded packs, from `commonPackPrefix`. */
  seriesPrefix?: string;
}>();

const emit = defineEmits<{ open: []; "toggle-select": []; rename: [string] }>();

const split = computed(() =>
  splitPackName(props.pack.name, props.seriesPrefix ?? ""),
);

// An explicit display name is a deliberate override and wins outright; the
// derived split only exists because none is set yet.
const title = computed(() => props.meta?.displayName || split.value.label);
// An explicit series/brand (meta.series) always wins, even alongside a
// custom display name — the two are orthogonal (a pack can be renamed AND
// still belong to a brand). Only the *derived* guess gets suppressed by a
// display name, since a custom name presumably already reads fine on its own.
const series = computed(
  () => props.meta?.series || (props.meta?.displayName ? "" : split.value.series),
);
const accent = computed(() => props.meta?.color || packAccent(props.pack.name));

const allInactive = computed(
  () => props.pack.black.active + props.pack.white.active === 0,
);
const inactiveCount = computed(
  () =>
    props.pack.black.total +
    props.pack.white.total -
    (props.pack.black.active + props.pack.white.active),
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
    class="pack-card"
    :class="[
      selected ? 'pack-card--selected' : '',
      allInactive ? 'pack-card--dark' : '',
    ]"
    :style="{ '--pack-accent': accent }"
  >
    <span
      data-testid="pack-accent"
      class="pack-card__accent"
      :style="{ background: accent }"
    />

    <button
      type="button"
      data-testid="pack-select"
      class="absolute top-3 right-3 z-10 w-4 h-4 rounded border"
      :class="selected ? 'bg-primary-600 border-primary-400' : 'border-slate-500 bg-slate-900/80'"
      :aria-pressed="selected"
      aria-label="Select pack"
      @click.stop="emit('toggle-select')"
    />

    <div class="pack-card__body">
      <p
        v-if="series"
        data-testid="pack-series"
        class="pack-card__series relative z-10"
      >
        {{ series }}
      </p>

      <input
        v-if="editing"
        ref="inputEl"
        v-model="draft"
        data-testid="pack-rename"
        class="relative z-10 w-full bg-slate-900 border border-primary-500 rounded px-1 text-base text-white"
        @keydown.enter="commitRename"
        @keydown.esc="editing = false"
        @blur="commitRename"
      />
      <h3
        v-else
        data-testid="pack-name"
        class="pack-card__title relative z-10"
        :title="pack.name"
        @dblclick.stop="startRename"
      >
        <span v-if="meta?.icon" class="mr-1">{{ meta.icon }}</span>{{ title }}
      </h3>

      <p v-if="meta?.description" class="pack-card__desc">
        {{ meta.description }}
      </p>

      <span class="flex-1" />

      <div class="flex h-1.5 rounded overflow-hidden bg-slate-950/70">
        <div class="bg-slate-600" :style="{ flexGrow: pack.black.total }" />
        <div class="bg-slate-300" :style="{ flexGrow: pack.white.total }" />
      </div>

      <p class="pack-card__counts">
        <span class="text-slate-200 font-semibold">{{ pack.black.total.toLocaleString() }}</span>
        black ·
        <span class="text-slate-200 font-semibold">{{ pack.white.total.toLocaleString() }}</span>
        white
        <template v-if="inactiveCount > 0 && !allInactive">
          ·
          <span class="text-amber-300/90">{{ inactiveCount.toLocaleString() }} inactive</span>
        </template>
      </p>

      <div class="flex flex-wrap gap-1">
        <span v-if="isDefault" class="pack-card__badge bg-amber-900/60 text-amber-200">★ default</span>
        <span v-if="meta?.official" class="pack-card__badge bg-slate-700 text-slate-300">official</span>
        <span v-if="meta?.nsfw" class="pack-card__badge bg-red-950 text-red-300">nsfw</span>
        <span v-if="allInactive" class="pack-card__badge bg-slate-700 text-slate-400">all inactive</span>
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

<style scoped>
/* Mirrors .lobby-card in app/pages/game/index.vue so the admin reads as part
   of the same product. Kept local rather than extracted: the two have no
   shared ancestor, and duplicating ~20 declarations beats inventing a shared
   abstraction for two call sites. */
.pack-card {
  position: relative;
  display: flex;
  min-height: 190px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  color: #f8fafc;
  background:
    repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.018) 0 8px, transparent 8px 18px),
    rgba(10, 13, 28, 0.82);
  box-shadow: 0 18px 35px -24px rgba(0, 0, 0, 0.95);
  transition:
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    border-color 180ms,
    box-shadow 180ms;
}

.pack-card:hover {
  transform: translateY(-4px) rotate(-0.35deg);
  border-color: var(--pack-accent);
  box-shadow:
    0 24px 40px -22px rgba(0, 0, 0, 0.9),
    0 0 0 1px var(--pack-accent);
}

.pack-card--selected {
  border-color: var(--pack-accent);
  box-shadow: 0 0 0 2px var(--pack-accent);
}

.pack-card--dark {
  opacity: 0.55;
}

.pack-card__accent {
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
}

.pack-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem 1rem 0.875rem;
}

.pack-card__series {
  font-size: 0.5625rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
  margin-bottom: -0.25rem;
  padding-right: 1.5rem;
}

.pack-card__title {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.25;
  color: #f1f5f9;
  padding-right: 1.5rem;
  /* Two lines, not one truncated line — the distinguishing half of a pack
     name is routinely longer than a tile is wide. */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pack-card__desc {
  font-size: 0.6875rem;
  line-height: 1.4;
  color: #94a3b8;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pack-card__counts {
  font-size: 0.625rem;
  color: #94a3b8;
}

.pack-card__badge {
  font-size: 0.5625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
}
</style>
