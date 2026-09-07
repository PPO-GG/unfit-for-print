<script setup lang="ts">
/**
 * Inspector state ② — one card, edited in place. This replaces the edit
 * modal: the grid stays visible, so you keep your position in a long scan.
 *
 * `draft` is local and re-seeds whenever a different card is inspected, so
 * clicking away from an unsaved edit discards it rather than leaking it onto
 * the next card.
 */
import { reactive, watch } from "vue";
import type { AdminCard } from "~/composables/useAdminCardList";

const props = defineProps<{
  card: AdminCard;
  packs: string[];
  saving?: boolean;
}>();

const emit = defineEmits<{
  save: [{ text: string; pick?: number }];
  move: [string];
  "toggle-active": [];
  delete: [];
}>();

const draft = reactive({ text: props.card.text ?? "", pick: props.card.pick ?? 1 });

watch(
  () => props.card.id,
  () => {
    draft.text = props.card.text ?? "";
    draft.pick = props.card.pick ?? 1;
  },
);

function save() {
  const text = draft.text.trim();
  if (!text) return;

  const pick = props.card.type === "black" ? Number(draft.pick) || 1 : undefined;
  // Both blur and Ctrl/Cmd+Enter reach this. Without a dirty check, saving
  // with the keyboard and then moving focus away sends the same edit twice.
  const unchanged =
    text === (props.card.text ?? "").trim() &&
    pick === (props.card.type === "black" ? props.card.pick ?? 1 : undefined);
  if (unchanged) return;

  emit("save", { text, pick });
}

defineExpose({ draft, save });
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="text-[10px] uppercase tracking-wider text-slate-500">
      {{ card.type }} card
    </p>

    <UFormField label="Text">
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
