<script setup lang="ts">
import type {
  CompactAction,
  CompactActionState,
} from "~/utils/compactActionState";

const props = defineProps<{ state: CompactActionState }>();
const emit = defineEmits<{ act: [action: CompactAction] }>();
const { t } = useI18n();

const label = computed(() =>
  props.state.params
    ? t(props.state.labelKey, props.state.params)
    : t(props.state.labelKey),
);

function onClick() {
  if (props.state.action) emit("act", props.state.action);
}
</script>

<template>
  <div class="compact-action-bar">
    <!-- Fade into the content above. It and the bar ignore pointers so taps
         on cards just above the button land on the cards (the old mobile bar
         swallowed them). -->
    <div class="compact-action-fade" aria-hidden="true" />
    <button
      type="button"
      class="compact-action-btn"
      :class="`compact-action-btn--${state.tone}`"
      :disabled="!state.action"
      @click="onClick"
    >
      {{ label }}
    </button>
  </div>
</template>

<style scoped>
.compact-action-bar {
  position: relative;
  padding: 0.5rem 0.75rem max(0.75rem, env(safe-area-inset-bottom));
  pointer-events: none;
}
.compact-action-fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100%;
  height: 2.5rem;
  background: linear-gradient(transparent, var(--lb-bg-0));
  pointer-events: none;
}
.compact-action-btn {
  pointer-events: auto;
  width: 100%;
  min-height: 48px;
  border-radius: 12px;
  font-family: "Archivo Black", sans-serif;
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  transition: transform 0.12s ease, background-color 0.2s ease;
}
.compact-action-btn:active:not(:disabled) {
  transform: translateY(2px);
}
.compact-action-btn--primary {
  background: var(--lb-accent);
  color: var(--lb-bg-0);
  box-shadow: 0 4px 0 var(--lb-accent-shadow);
}
.compact-action-btn--judge {
  background: var(--lb-accent-yellow);
  color: var(--lb-bg-0);
  box-shadow: 0 4px 0 oklch(62% 0.18 95);
}
.compact-action-btn--muted {
  background: var(--lb-bg-2);
  color: var(--lb-ink-dim);
  border: 1px solid var(--lb-line);
  cursor: default;
}
</style>
