<script setup lang="ts">
/**
 * Pack navigation only: name and total. Every pack *operation* lives on the
 * Packs screen or in the inspector — this rail exists so you can hop packs
 * without going up a level, and nothing more. The old sidebar carried about
 * fifteen controls per row, which is what made it unusable.
 */
import type { AdminPackStat } from "~/composables/useAdminPackStats";
import type { CardPackMeta } from "~/types/cardPack";
import { packLabel } from "~/utils/packName";

const props = defineProps<{
  packs: AdminPackStat[];
  current?: string;
  /** Keyed by pack name, so a custom display name shows here too — this used
   * to always show the raw pack key, so renaming a pack in AdminPackForm
   * looked like it had no effect as long as you were browsing it. */
  packMeta?: Record<string, CardPackMeta>;
  /** Shared series prefix across the loaded packs, from `commonPackPrefix`. */
  seriesPrefix?: string;
}>();
const emit = defineEmits<{ select: [string] }>();

const total = (p: AdminPackStat) => p.black.total + p.white.total;
const isDark = (p: AdminPackStat) => p.black.active + p.white.active === 0;

/**
 * Series and name are stacked rather than rendered as one "Series: Name"
 * line. In a 224px rail the composed string truncates at almost exactly the
 * point the raw pack key used to — which was the original complaint, 106 rows
 * all reading "Cards Against Humanity…". Giving the series its own dim line
 * leaves the whole width to the half that identifies the pack, and matches
 * the eyebrow/headline treatment AdminPackTile already uses.
 */
const label = (p: AdminPackStat) =>
  packLabel(p.name, props.packMeta?.[p.name], props.seriesPrefix ?? "");
</script>

<template>
  <nav class="h-full overflow-y-auto border-r border-slate-700/60 bg-slate-900/40 p-2">
    <NuxtLink
      to="/admin/cards"
      class="block px-2 py-1.5 mb-2 text-xs text-slate-400 hover:text-white transition-colors"
    >
      ← All packs
    </NuxtLink>

    <button
      v-for="pack in packs"
      :key="pack.name"
      type="button"
      :data-testid="`pack-${pack.name}`"
      :aria-current="pack.name === current"
      class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors mb-0.5"
      :class="[
        pack.name === current
          ? 'bg-primary-900/60 text-white ring-1 ring-primary-500/50'
          : 'text-slate-300 hover:bg-slate-800',
        isDark(pack) ? 'opacity-50' : '',
      ]"
      @click="emit('select', pack.name)"
    >
      <!-- The raw key stays on hover: it is the pack's real id, and the
           label above it may be nothing like it. -->
      <span class="flex-1 min-w-0" :title="pack.name">
        <span
          v-if="label(pack).series"
          class="block truncate text-[0.625rem] leading-tight text-slate-500 uppercase tracking-wide"
          >{{ label(pack).series }}</span
        >
        <span class="block truncate">{{ label(pack).name }}</span>
      </span>
      <span class="shrink-0 text-slate-500">{{ total(pack).toLocaleString() }}</span>
    </button>
  </nav>
</template>
