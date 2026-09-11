<script setup lang="ts">
/**
 * Front layers (top-first), a fixed Avatar row, then behind layers
 * (top-first). Reordering works by drag-and-drop or the ▲▼ buttons; both
 * cross the avatar row at the ends of a side, which is how a layer's
 * `side` changes.
 */
import { computed, nextTick, ref } from "vue";
import {
  LAYER_TYPES, MAX_LAYERS,
  type DecorationLayers, type Layer, type LayerSide, type LayerType,
} from "#shared/decorationLayers";
import { sideLists } from "~/utils/decorationStack";
import { LAYER_ICONS, LAYER_LABELS } from "~/utils/decorationFields";

const props = defineProps<{ stack: DecorationLayers; selectedId: string | null }>();
const emit = defineEmits<{
  select: [string];
  add: [LayerType];
  remove: [string];
  duplicate: [string];
  move: [string, LayerSide, number];
  "toggle-visible": [string];
  rename: [string, string];
}>();

const lists = computed(() => sideLists(props.stack));
const full = computed(() => props.stack.layers.length >= MAX_LAYERS);
const label = (l: Layer) => l.name || LAYER_LABELS[l.type];

function nudge(l: Layer, dir: -1 | 1) {
  const { front, behind } = lists.value;
  const list = l.side === "front" ? front : behind;
  const target = list.findIndex((x) => x.id === l.id) + dir;
  if (target >= 0 && target < list.length) return emit("move", l.id, l.side, target);
  if (l.side === "front" && dir === 1) return emit("move", l.id, "behind", 0);
  if (l.side === "behind" && dir === -1) return emit("move", l.id, "front", front.length);
}

// ─── Drag and drop ──────────────────────────────────────────────────────
const dragId = ref<string | null>(null);
function dropOnRow(target: Layer) {
  const id = dragId.value;
  dragId.value = null;
  if (!id || id === target.id) return;
  const list = (target.side === "front" ? lists.value.front : lists.value.behind).filter((l) => l.id !== id);
  emit("move", id, target.side, list.findIndex((l) => l.id === target.id));
}
function dropOnAvatar() {
  const id = dragId.value;
  dragId.value = null;
  const layer = props.stack.layers.find((l) => l.id === id);
  if (!layer) return;
  if (layer.side === "front") emit("move", layer.id, "behind", 0);
  else emit("move", layer.id, "front", lists.value.front.length);
}

// ─── Inline rename ──────────────────────────────────────────────────────
const renaming = ref<string | null>(null);
const draft = ref("");
const renameInput = ref<HTMLInputElement[] | null>(null);
async function startRename(l: Layer) {
  renaming.value = l.id;
  draft.value = label(l);
  await nextTick();
  renameInput.value?.[0]?.focus();
}
function commitRename() {
  const id = renaming.value;
  if (!id) return;
  renaming.value = null; // cleared first so the blur Enter causes is a no-op
  if (draft.value.trim()) emit("rename", id, draft.value.trim());
}
</script>

<template>
  <div class="flex flex-col gap-1 text-sm">
    <template v-for="group in (['front', 'behind'] as const)" :key="group">
      <div class="px-1 pt-2 text-xs uppercase tracking-wide text-slate-500">
        {{ group === "front" ? "Front" : "Behind" }}
      </div>
      <p v-if="lists[group].length === 0" class="px-1 text-xs italic text-slate-600">No layers</p>
      <div
        v-for="layer in lists[group]"
        :key="layer.id"
        :data-testid="`layer-row-${layer.id}`"
        class="group flex items-center gap-1 rounded-md border border-slate-700 px-1.5 py-1"
        :class="{ 'is-selected border-primary-500 bg-primary-500/10': layer.id === selectedId, 'opacity-50': !layer.visible }"
        draggable="true"
        @dragstart="dragId = layer.id"
        @dragover.prevent
        @drop.prevent="dropOnRow(layer)"
      >
        <UIcon name="i-lucide-grip-vertical" class="shrink-0 cursor-grab text-slate-500" />
        <button data-testid="layer-select" class="flex min-w-0 flex-1 items-center gap-1.5 text-left" @click="emit('select', layer.id)">
          <UIcon :name="LAYER_ICONS[layer.type]" class="shrink-0" />
          <input
            v-if="renaming === layer.id"
            ref="renameInput"
            v-model="draft"
            data-testid="layer-rename"
            class="min-w-0 flex-1 rounded bg-slate-800 px-1"
            @keydown.enter="commitRename"
            @keydown.esc="renaming = null"
            @blur="commitRename"
            @click.stop
          />
          <span v-else data-testid="layer-name" class="truncate" @dblclick.stop="startRename(layer)">{{ label(layer) }}</span>
        </button>
        <UButton data-testid="layer-up" size="xs" variant="ghost" color="neutral" icon="i-lucide-chevron-up" aria-label="Move up" @click="nudge(layer, -1)" />
        <UButton data-testid="layer-down" size="xs" variant="ghost" color="neutral" icon="i-lucide-chevron-down" aria-label="Move down" @click="nudge(layer, 1)" />
        <UButton data-testid="layer-eye" size="xs" variant="ghost" color="neutral" :icon="layer.visible ? 'i-lucide-eye' : 'i-lucide-eye-off'" aria-label="Toggle visibility" @click="emit('toggle-visible', layer.id)" />
        <UButton data-testid="layer-duplicate" size="xs" variant="ghost" color="neutral" icon="i-lucide-copy" aria-label="Duplicate" @click="emit('duplicate', layer.id)" />
        <UButton data-testid="layer-remove" size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" aria-label="Delete layer" @click="emit('remove', layer.id)" />
      </div>
      <div
        v-if="group === 'front'"
        data-testid="layer-avatar-row"
        class="mt-2 flex items-center gap-2 rounded-md border border-dashed border-slate-600 bg-slate-800/50 px-2 py-1.5 text-slate-400"
        @dragover.prevent
        @drop.prevent="dropOnAvatar"
      >
        <UIcon name="i-lucide-circle-user" /> Avatar
      </div>
    </template>

    <div class="mt-3 border-t border-slate-700 pt-3">
      <div class="mb-1 px-1 text-xs uppercase tracking-wide text-slate-500">Add layer</div>
      <p v-if="full" class="px-1 text-xs text-amber-400">{{ MAX_LAYERS }}-layer limit reached</p>
      <div v-else class="grid grid-cols-5 gap-1">
        <UButton
          v-for="type in LAYER_TYPES"
          :key="type"
          :data-testid="`add-${type}`"
          size="xs"
          variant="soft"
          color="neutral"
          :icon="LAYER_ICONS[type]"
          :aria-label="`Add ${LAYER_LABELS[type]}`"
          :title="LAYER_LABELS[type]"
          @click="emit('add', type)"
        />
      </div>
    </div>
  </div>
</template>
