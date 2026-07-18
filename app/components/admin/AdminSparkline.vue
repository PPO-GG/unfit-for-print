<!--
  Lightweight polyline sparkline for KPI tiles.
  Ported from the design prototype; no external dependency.
-->
<template>
  <svg :width="w" :height="h" :viewBox="`0 0 ${w} ${h}`">
    <polyline
      :points="points"
      fill="none"
      :stroke="color"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    data: readonly number[];
    color?: string;
    w?: number;
    h?: number;
  }>(),
  {
    color: "var(--accent-3)",
    w: 80,
    h: 24,
  },
);

const points = computed<string>(() => {
  const { data, w, h } = props;
  if (data.length === 0) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return data
    .map((v, i) => {
      const x = (i / Math.max(1, data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
});
</script>
