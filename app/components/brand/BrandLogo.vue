<!--
  UFP logo lockup — the stacked "UNFIT / FOR / PRINT" mark in a
  bordered square, optionally paired with the full wordmark beside it.
  Used in the top bar, plus standalone in a few places.
-->
<template>
  <div class="brand-logo-row">
    <div
      class="brand-logo-mark"
      :style="{
        width: `${size}px`,
        height: `${size}px`,
      }"
    >
      <div
        class="font-display brand-logo-stack"
        :style="{ fontSize: `${size * 0.22}px` }"
      >
        UNFIT<br />FOR<br />PRINT
      </div>
    </div>
    <div v-if="withWordmark" class="brand-logo-wordmark hidden sm:block">
      <div class="brand-logo-eyebrow font-mono">Party of the year</div>
      <div class="brand-logo-title font-display">UNFIT FOR PRINT</div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Size (in px) of the square mark. */
    size?: number;
    /** If true, show the "UNFIT FOR PRINT" wordmark beside the mark. */
    withWordmark?: boolean;
  }>(),
  { size: 40, withWordmark: true },
);
</script>

<style scoped>
.brand-logo-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-logo-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: #0d0f1a;
  border: 1.5px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.03);
  flex-shrink: 0;
}

.brand-logo-stack {
  line-height: 0.95;
  letter-spacing: -0.01em;
  text-align: center;
}

.brand-logo-eyebrow {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--ink-muted);
}

.brand-logo-title {
  font-size: 18px;
  line-height: 1;
}
</style>
