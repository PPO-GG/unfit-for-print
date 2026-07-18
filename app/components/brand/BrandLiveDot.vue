<!--
  Pulsing lime dot that signals "live" / "online" state.
  Styled via .live-dot in brand.css.
-->
<template>
  <span class="live-dot" :style="dotStyle" />
</template>

<script setup lang="ts">
import type { CSSProperties } from "vue";

const props = withDefaults(
  defineProps<{
    size?: number;
    /** Tailwind-like color override; defaults to brand lime. */
    color?: string;
  }>(),
  { size: 8 },
);

const dotStyle = computed<CSSProperties>(() => {
  const s: CSSProperties = {
    width: `${props.size}px`,
    height: `${props.size}px`,
  };
  if (props.color) s.background = props.color;
  return s;
});
</script>
