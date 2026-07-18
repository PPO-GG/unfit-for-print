<!--
  Centered modal scaffold used by the card editor and announcement
  composer. Click the backdrop or press Esc to close.

  Rendered in-place (not teleported) so the surrounding `.admin-root`
  scope still applies to buttons, inputs, pills, etc.

  Usage:
    <AdminModal v-if="open" title="…" eyebrow="…" @close="open = false">
      <template #body>…</template>
      <template #footer>…</template>
    </AdminModal>
-->
<template>
  <div class="admin-modal-backdrop" @click="emit('close')" />
  <div
    class="admin-modal"
    :style="{ width: `${width}px` }"
    role="dialog"
    aria-modal="true"
    @click.stop
  >
    <div class="panel-header">
      <div>
        <div v-if="eyebrow" class="panel-eyebrow">{{ eyebrow }}</div>
        <div class="panel-title">{{ title }}</div>
      </div>
      <button class="icon-btn" aria-label="Close" @click="emit('close')">
        <AdminIcon name="x" :size="14" />
      </button>
    </div>
    <div class="admin-modal-body">
      <slot name="body" />
    </div>
    <div v-if="$slots.footer" class="admin-modal-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onKeyStroke } from "@vueuse/core";

withDefaults(
  defineProps<{
    title: string;
    eyebrow?: string;
    width?: number;
  }>(),
  { width: 520 },
);

const emit = defineEmits<{ close: [] }>();

onKeyStroke("Escape", () => emit("close"));
</script>

<style scoped>
.admin-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 100;
  backdrop-filter: blur(2px);
}

.admin-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-width: 92vw;
  max-height: 90vh;
  overflow-y: auto;
  z-index: 101;
  background: var(--bg-1);
  border: 1px solid var(--line-strong);
  border-radius: 14px;
  box-shadow: 0 30px 60px -10px rgba(0, 0, 0, 0.7);
}

.admin-modal-body {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-modal-footer {
  padding: 0 22px 22px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
