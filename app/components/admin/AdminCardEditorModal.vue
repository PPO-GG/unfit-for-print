<!--
  Create-or-edit card modal. Used on the Cards admin page.
  Emits `save` with the working draft when confirmed; parent decides
  whether to hit the real API (when one exists).
-->
<template>
  <AdminModal
    :title="mode === 'new' ? 'New Card' : 'Edit Card'"
    :eyebrow="mode === 'new' ? 'Create' : 'Edit'"
    :width="520"
    @close="emit('close')"
  >
    <template #body>
      <div>
        <label class="label">Kind</label>
        <div class="kind-buttons">
          <button
            v-for="k in (['answer', 'prompt'] as const)"
            :key="k"
            type="button"
            :class="['btn', kind === k ? (k === 'answer' ? 'primary' : 'cyan') : 'ghost']"
            @click="kind = k"
          >{{ k.toUpperCase() }}</button>
        </div>
      </div>

      <div>
        <label class="label">
          Text {{ kind === "prompt" ? "(use ___ for blanks)" : "" }}
        </label>
        <textarea
          v-model="text"
          class="textarea"
          :placeholder="kind === 'prompt' ? 'Why am I crying? ___.' : 'A raccoon with a clipboard.'"
        />
      </div>

      <div v-if="kind === 'prompt'">
        <label class="label">Picks</label>
        <select v-model.number="picks" class="select">
          <option :value="1">1 (single answer)</option>
          <option :value="2">2 (two-blank)</option>
          <option :value="3">3 (three-blank)</option>
        </select>
      </div>

      <div>
        <label class="label">Preview</label>
        <div class="preview-frame">
          <div :class="['cah-mini', kind]" class="preview-card">
            <div class="preview-card-body">
              {{ text || (kind === "prompt" ? "Why am I crying? ___." : "Your answer here.") }}
            </div>
            <div class="preview-card-footer">
              <div class="brand-mark">UNFIT FOR PRINT</div>
              <div v-if="kind === 'prompt'" class="pick-mark">PICK {{ picks }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <button class="btn ghost" @click="emit('close')">Cancel</button>
      <button class="btn primary" @click="onSave">
        {{ mode === "new" ? "Create card" : "Save changes" }}
      </button>
    </template>
  </AdminModal>
</template>

<script setup lang="ts">
import type { AdminCardKind, AdminCardRow } from "~/types/admin";

const props = defineProps<{
  mode: "new" | "edit";
  /** Existing card when mode === 'edit'. */
  card?: AdminCardRow;
}>();

const emit = defineEmits<{
  close: [];
  save: [draft: AdminCardRow];
}>();

const kind = ref<AdminCardKind>(props.card?.kind ?? "answer");
const text = ref<string>(props.card?.text ?? "");
const picks = ref<number>(props.card?.picks ?? 1);

function onSave() {
  const draft: AdminCardRow = {
    id: props.card?.id ?? `new-${Date.now()}`,
    kind: kind.value,
    text: text.value,
    picks: kind.value === "prompt" ? picks.value : undefined,
    pack: props.card?.pack ?? "core",
    added: props.card?.added ?? new Date().toISOString().slice(0, 10),
    plays: props.card?.plays ?? 0,
    hot: props.card?.hot ?? 0,
  };
  emit("save", draft);
  emit("close");
}
</script>

<style scoped>
.kind-buttons {
  display: flex;
  gap: 8px;
}

.kind-buttons .btn {
  flex: 1;
  justify-content: center;
}

.preview-frame {
  display: flex;
  justify-content: center;
  padding: 18px;
  border: 1px dashed var(--line-strong);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.2);
}

.preview-card {
  width: 200px;
  min-height: 260px;
  font-size: 17px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
}

.preview-card-body {
  flex: 1;
}

.preview-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 12px;
}

.brand-mark {
  font-family: "Archivo Black", sans-serif;
  font-size: 8px;
  opacity: 0.6;
}

.pick-mark {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  opacity: 0.7;
}
</style>
