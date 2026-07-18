<!--
  Volume row used by the settings drawer for Music + SFX.
  Emits `update:vol` (number) and `update:muted` (boolean).

  The slider is disabled while muted so users can't accidentally drag
  a muted channel up — they have to unmute first.
-->
<template>
  <div class="settings-vol-row">
    <div class="settings-vol-head">
      <span
        class="settings-drill-icon"
        :style="{ opacity: muted ? 0.4 : 1 }"
      >{{ icon }}</span>
      <div
        class="settings-drill-label flex-1"
        :style="{ opacity: muted ? 0.5 : 1 }"
      >{{ label }}</div>
      <div :class="['settings-vol-count', { muted }]">
        {{ muted ? "--" : `${vol}%` }}
      </div>
      <button
        type="button"
        :class="['settings-mute', { on: muted }]"
        @click="emit('update:muted', !muted)"
      >{{ muted ? "OFF" : "ON" }}</button>
    </div>
    <div class="settings-vol-slider">
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        :value="vol"
        :disabled="muted"
        :style="{ opacity: muted ? 0.4 : 1 }"
        @input="emit('update:vol', Number(($event.target as HTMLInputElement).value))"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string;
  label: string;
  vol: number;
  muted: boolean;
}>();

const emit = defineEmits<{
  "update:vol": [value: number];
  "update:muted": [value: boolean];
}>();
</script>

<style scoped>
.flex-1 { flex: 1; min-width: 0; }
</style>
