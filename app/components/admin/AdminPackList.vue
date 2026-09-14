<script setup lang="ts">
/**
 * The Explorer's left pane: every pack, grouped by series, with the same
 * click / Ctrl / Shift rules as the card table. Selecting packs filters the
 * table; the parent owns the selection and the menu items.
 */
import type { ContextMenuItem } from "@nuxt/ui";
import type { PackChip, PackListRow, PackSort } from "~/utils/packListView";
import { isPackDisabled, packTotal } from "~/utils/packListView";

const props = defineProps<{
  rows: PackListRow[];
  selectedIds: string[];
  currentId?: string | null;
  chipCounts: Record<PackChip, number>;
  totalCards: number;
  menu: ContextMenuItem[][];
}>();

const search = defineModel<string>("search", { required: true });
const chip = defineModel<PackChip>("chip", { required: true });
const sort = defineModel<PackSort>("sort", { required: true });
const grouped = defineModel<boolean>("grouped", { required: true });

const emit = defineEmits<{
  click: [id: string, mods: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }];
  all: [];
  contextmenu: [id: string];
}>();

const CHIPS: { id: PackChip; label: string }[] = [
  { id: "all", label: "All" },
  { id: "default", label: "Default" },
  { id: "official", label: "Official" },
  { id: "nsfw", label: "NSFW" },
  { id: "inactive", label: "Disabled" },
];
const SORTS: { id: PackSort; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "size", label: "Size" },
  { id: "disabled", label: "Disabled" },
];

const mods = (e: MouseEvent) => ({ ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey });
const isSelected = (id: string) => props.selectedIds.includes(id);

function onContextmenu(id: string) {
  if (!isSelected(id)) emit("click", id, { ctrlKey: false, metaKey: false, shiftKey: false });
  emit("contextmenu", id);
}
</script>

<template>
  <nav class="h-full flex flex-col border-r border-slate-700/60 bg-slate-900/40">
    <div class="p-2 flex flex-col gap-2 border-b border-slate-700/60">
      <UInput v-model="search" placeholder="Filter packs…" icon="i-solar-magnifer-linear" size="sm" />
      <div class="flex flex-wrap gap-1">
        <button
          v-for="c in CHIPS"
          :key="c.id"
          type="button"
          :data-testid="`pack-chip-${c.id}`"
          :aria-pressed="chip === c.id"
          class="rounded-full px-2 py-0.5 text-[11px]"
          :class="chip === c.id ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'"
          @click="chip = c.id"
        >
          {{ c.label }} <span class="opacity-70">{{ chipCounts[c.id] }}</span>
        </button>
      </div>
      <div class="flex items-center justify-between gap-2">
        <div class="inline-flex rounded-md border border-slate-700 overflow-hidden text-[11px]">
          <button
            v-for="s in SORTS"
            :key="s.id"
            type="button"
            :data-testid="`pack-sort-${s.id}`"
            :aria-pressed="sort === s.id"
            class="px-2 py-0.5"
            :class="sort === s.id ? 'bg-primary-600 text-white' : 'text-slate-300 hover:bg-slate-800'"
            @click="sort = s.id"
          >
            {{ s.label }}
          </button>
        </div>
        <label class="flex items-center gap-1 text-[11px] text-slate-400">
          <UCheckbox v-model="grouped" data-testid="pack-grouped" size="xs" />
          Group by series
        </label>
      </div>
    </div>

    <UContextMenu :items="menu">
      <div class="flex-1 overflow-y-auto p-1" role="listbox" aria-multiselectable="true">
        <button
          type="button"
          data-testid="pack-all"
          class="w-full flex items-center px-2 py-1 rounded text-xs text-slate-400 hover:bg-slate-800"
          @click="emit('all')"
        >
          All packs <span class="ml-auto">{{ totalCards.toLocaleString() }}</span>
        </button>

        <template v-for="row in rows" :key="row.key">
          <div
            v-if="row.kind === 'group'"
            data-testid="pack-group"
            class="px-2 pt-2 pb-0.5 text-[10px] uppercase tracking-wider text-slate-500 flex"
          >
            {{ row.label }} <span class="ml-auto">{{ row.count }}</span>
          </div>
          <button
            v-else
            type="button"
            role="option"
            :data-testid="`pack-row-${row.pack.id}`"
            :aria-selected="isSelected(row.pack.id)"
            class="w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs text-left select-none"
            :class="[
              isSelected(row.pack.id) ? 'bg-primary-900/60 text-white' : 'text-slate-300 hover:bg-slate-800',
              row.pack.id === currentId ? 'ring-1 ring-primary-500/60' : '',
              isPackDisabled(row.pack) ? 'opacity-50' : '',
            ]"
            :title="row.pack.name"
            @click="emit('click', row.pack.id, mods($event))"
            @contextmenu="onContextmenu(row.pack.id)"
          >
            <span v-if="row.pack.isDefault" class="text-amber-300" aria-label="Default">★</span>
            <span class="truncate flex-1">{{ row.pack.name }}</span>
            <span class="shrink-0 text-slate-500">{{ packTotal(row.pack).toLocaleString() }}</span>
          </button>
        </template>
      </div>
    </UContextMenu>
  </nav>
</template>
