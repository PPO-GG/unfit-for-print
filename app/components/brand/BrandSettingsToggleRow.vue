<!--
  Toggle row with icon + label + optional sub-line. Emits `update:value`.
-->
<template>
  <div
    class="settings-toggle-row"
    role="button"
    tabindex="0"
    :aria-pressed="value"
    @click="emit('update:value', !value)"
    @keydown.space.prevent="emit('update:value', !value)"
    @keydown.enter.prevent="emit('update:value', !value)"
  >
    <span class="settings-drill-icon">{{ icon }}</span>
    <div class="flex-1">
      <div class="settings-drill-label">{{ label }}</div>
      <div v-if="sub" class="settings-toggle-sub">{{ sub }}</div>
    </div>
    <div :class="['settings-toggle', { on: value }]">
      <div class="settings-toggle-knob" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string;
  label: string;
  sub?: string;
  value: boolean;
}>();

const emit = defineEmits<{
  "update:value": [value: boolean];
}>();
</script>

<style scoped>
.flex-1 { flex: 1; min-width: 0; }
</style>
