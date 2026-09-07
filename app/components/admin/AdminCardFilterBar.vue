<script setup lang="ts">
/**
 * Type is a filter here, not a page mode. The counts matter as much as the
 * chips: they are the only place a pack's black/white balance is visible
 * without switching view.
 *
 * "Inactive" rides in the same row because it is the same kind of narrowing,
 * even though it crosses both types.
 */
import type { AdminCardFilter } from "~/composables/useCardSearch";
import type { AdminCardSort } from "~/composables/useAdminCardList";

defineProps<{
  filter: AdminCardFilter | "inactive";
  search: string;
  sort: AdminCardSort;
  counts: { all: number; white: number; black: number; inactive: number };
}>();

const emit = defineEmits<{
  "update:filter": [AdminCardFilter | "inactive"];
  "update:search": [string];
  "update:sort": [AdminCardSort];
}>();

const sortItems = [
  { label: "Pack order", value: "pack" },
  { label: "A–Z", value: "az" },
  { label: "Most played", value: "played-desc" },
  { label: "Least played", value: "played-asc" },
];
</script>

<template>
  <div class="flex items-center gap-2 px-3 py-2 border-b border-slate-700/60 bg-slate-900/60">
    <button
      v-for="chip in [
        { id: 'all', label: 'All', n: counts.all },
        { id: 'black', label: 'Black', n: counts.black },
        { id: 'white', label: 'White', n: counts.white },
        { id: 'inactive', label: 'Inactive', n: counts.inactive },
      ]"
      :key="chip.id"
      type="button"
      :data-testid="`chip-${chip.id}`"
      :aria-pressed="filter === chip.id"
      class="rounded-full px-3 py-1 text-xs transition-colors"
      :class="
        filter === chip.id
          ? 'bg-primary-600 text-white'
          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
      "
      @click="emit('update:filter', chip.id as AdminCardFilter | 'inactive')"
    >
      {{ chip.label }}
      <span class="opacity-70 ml-1">{{ chip.n }}</span>
    </button>

    <UInput
      :model-value="search"
      placeholder="Search cards…"
      icon="i-solar-magnifer-linear"
      class="flex-1 min-w-40"
      @update:model-value="emit('update:search', String($event))"
    />

    <USelectMenu
      :model-value="sort"
      :items="sortItems"
      value-key="value"
      class="w-44"
      @update:model-value="emit('update:sort', $event as AdminCardSort)"
    />
  </div>
</template>
