<script setup lang="ts">
/**
 * One panel, three states:
 *   ① nothing selected  → the pack itself (AdminPackForm, added in Task 12)
 *   ② one card          → edit it in place
 *   ③ several selected  → a bulk summary, so the panel is not blank during
 *                         the very operation you are performing
 *
 * A bulk selection wins over an inspected card: while you are acting on many,
 * the panel should describe the many.
 */
import { computed } from "vue";
import type { AdminCard } from "~/composables/useAdminCardList";
import type { CardPackMeta } from "~/types/cardPack";

const props = defineProps<{
  card?: AdminCard | null;
  selectedCount: number;
  packs: string[];
  packName?: string;
  packMeta?: CardPackMeta | null;
  packCards?: AdminCard[];
  /** Shared series prefix across the loaded packs, from `commonPackPrefix`. */
  seriesPrefix?: string;
}>();

const emit = defineEmits<{
  save: [{ text: string; pick?: number }];
  move: [string];
  "toggle-active": [];
  delete: [];
  "pack-saved": [CardPackMeta];
}>();

const state = computed<"pack" | "card" | "bulk">(() => {
  if (props.selectedCount > 1) return "bulk";
  if (props.card) return "card";
  return "pack";
});
</script>

<template>
  <aside class="h-full overflow-y-auto border-l border-slate-700/60 bg-slate-900/40 p-3">
    <div v-if="state === 'bulk'" data-testid="state-bulk" class="flex flex-col gap-2">
      <p class="text-[10px] uppercase tracking-wider text-slate-500">Selection</p>
      <p class="text-lg font-semibold text-slate-100">
        {{ selectedCount.toLocaleString() }} cards
      </p>
      <p class="text-xs text-slate-400">
        Use the bar below the grid to move, deactivate or delete them.
      </p>
    </div>

    <AdminCardForm
      v-else-if="state === 'card' && card"
      :card="card"
      :packs="packs"
      :pack-cards="packCards"
      @save="emit('save', $event)"
      @move="emit('move', $event)"
      @toggle-active="emit('toggle-active')"
      @delete="emit('delete')"
    />

    <div v-else data-testid="state-pack" class="flex flex-col gap-2">
      <template v-if="packName">
        <AdminPackForm
          :pack="packName"
          :meta="packMeta ?? null"
          :series-prefix="seriesPrefix"
          @saved="emit('pack-saved', $event)"
        />
      </template>
      <p v-else class="text-xs text-slate-400">Select a card to inspect it.</p>
    </div>
  </aside>
</template>
