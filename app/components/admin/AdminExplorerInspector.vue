<script setup lang="ts">
/**
 * The right pane. It shows whatever the admin last clicked into: one card,
 * many cards, one pack, many packs — and relays each editor's events with a
 * scope so the page has one place to handle them.
 */
import { computed, ref } from "vue";
import type { AdminCard, AdminPack } from "~/types/adminCard";
import type { PackDraft } from "~/utils/packDraft";

const props = defineProps<{
  focus: "pack" | "card";
  packs: AdminPack[];
  cards: AdminCard[];
  packNames: string[];
  packCards: AdminCard[];
  seriesPrefix: string;
  busy?: boolean;
}>();

const emit = defineEmits<{
  "card-save": [{ text: string; pick?: number; pack?: string }];
  "card-toggle-active": [];
  "card-delete": [];
  "cards-apply": [{ pack?: string; active?: boolean; pick?: number }];
  "cards-delete": [];
  "pack-save": [PackDraft];
  "pack-delete": [];
  "packs-apply": [Record<string, string | boolean>];
  "packs-merge": [];
  "packs-delete": [];
  narrow: [scope: "pack" | "card", id: string];
  drop: [scope: "pack" | "card", id: string];
}>();

const mode = computed(() => {
  if (props.focus === "card" && props.cards.length === 1) return "card";
  if (props.focus === "card" && props.cards.length > 1) return "cards";
  if (props.focus === "pack" && props.packs.length === 1) return "pack";
  if (props.focus === "pack" && props.packs.length > 1) return "packs";
  return "empty";
});

type Editor = { dirty?: boolean; focusText?: () => void; focusName?: () => void } | null;
const editor = ref<Editor>(null);
const dirty = computed(() => Boolean(editor.value?.dirty));

defineExpose({
  dirty,
  focusText: () => editor.value?.focusText?.(),
  focusName: () => editor.value?.focusName?.(),
});
</script>

<template>
  <aside class="h-full overflow-y-auto border-l border-slate-700/60 bg-slate-900/40 p-3">
    <AdminCardForm
      v-if="mode === 'card'"
      ref="editor"
      :key="cards[0]!.id"
      :card="cards[0]!"
      :packs="packNames"
      :pack-cards="packCards"
      :saving="busy"
      @save="emit('card-save', $event)"
      @toggle-active="emit('card-toggle-active')"
      @delete="emit('card-delete')"
    />
    <AdminCardBulkForm
      v-else-if="mode === 'cards'"
      ref="editor"
      :cards="cards"
      :packs="packNames"
      :busy="busy"
      @apply="emit('cards-apply', $event)"
      @delete="emit('cards-delete')"
      @narrow="emit('narrow', 'card', $event)"
      @drop="emit('drop', 'card', $event)"
    />
    <AdminPackForm
      v-else-if="mode === 'pack'"
      ref="editor"
      :pack="packs[0]!"
      :series-prefix="seriesPrefix"
      :saving="busy"
      @save="emit('pack-save', $event)"
      @delete="emit('pack-delete')"
    />
    <AdminPackBulkForm
      v-else-if="mode === 'packs'"
      ref="editor"
      :packs="packs"
      :busy="busy"
      @apply="emit('packs-apply', $event)"
      @merge="emit('packs-merge')"
      @delete="emit('packs-delete')"
      @narrow="emit('narrow', 'pack', $event)"
      @drop="emit('drop', 'pack', $event)"
    />
    <p v-else data-testid="inspector-empty" class="text-xs text-slate-400">Select a pack or a card.</p>
  </aside>
</template>
