<script setup lang="ts">
/**
 * The card grid, windowed by row.
 *
 * Pagination used to cap the DOM at 30 tiles; scrolling a 1,235-card pack
 * would mount all of them, so the rows go through `useVirtualList` and only
 * those near the viewport exist. Row height is derived from the measured
 * tile width via `rowHeight`, since the tile has no fixed CSS height — it is
 * `aspect-ratio: 3 / 4` on .admin-card-preview.
 */
import { computed, ref } from "vue";
import { useElementSize, useVirtualList } from "@vueuse/core";
import { gridGeometry, chunkRows, rowHeight, GRID_GAP } from "~/utils/gridGeometry";
import { getCardImageUrl } from "~/utils/cardImage";
import type { AdminCard } from "~/composables/useAdminCardList";

const props = defineProps<{
  cards: AdminCard[];
  selectedIds: string[];
  inspectedId?: string | null;
  /** Pack name → colour, so a cross-pack search stays readable. */
  packColors?: Record<string, string>;
}>();

// `select` carries the originating MouseEvent alongside the id, so the page
// can route a shift-click to the range selector and a plain click to a toggle.
const emit = defineEmits<{ select: [string, MouseEvent]; inspect: [string] }>();

const container = ref<HTMLElement | null>(null);
const { width } = useElementSize(container);

const columns = computed(() => gridGeometry(width.value).columns);
const rows = computed(() => chunkRows(props.cards, columns.value));
const rowPx = computed(() => rowHeight(width.value));

const { list, containerProps, wrapperProps } = useVirtualList(rows, {
  itemHeight: () => rowPx.value,
  overscan: 4,
});

const isSelected = (id: string) => props.selectedIds.includes(id);
</script>

<template>
  <div ref="container" class="h-full">
    <div v-bind="containerProps" class="h-full overflow-y-auto">
      <div v-bind="wrapperProps">
        <div
          v-for="row in list"
          :key="row.index"
          class="grid"
          :style="{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: `${GRID_GAP}px`,
            height: `${rowPx}px`,
          }"
        >
          <AdminCardPreview
            v-for="card in row.data"
            :key="card.id"
            :text="card.text"
            :pack="card.pack"
            :active="card.active"
            :type="card.type"
            :pick="card.pick"
            :selected="isSelected(card.id)"
            :inspected="card.id === inspectedId"
            :stripe-color="card.pack ? packColors?.[card.pack] : undefined"
            :image-url="card.imageKey ? getCardImageUrl(card.imageKey) : undefined"
            :attachment="card.attachment"
            @click="emit('inspect', card.id)"
            @toggle-select="emit('select', card.id, $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
