<!--
  Area + line sparkline for the "recent performance" card. Render size is
  100% wide, height is controlled via prop. Uses `preserveAspectRatio=none`
  so the curve stretches to fill.
-->
<template>
  <svg
    class="sparkline"
    :viewBox="`0 0 100 ${height}`"
    :style="{ height: `${height}px` }"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="color" stop-opacity="0.35" />
        <stop offset="100%" :stop-color="color" stop-opacity="0" />
      </linearGradient>
    </defs>
    <polygon :points="areaPoints" :fill="`url(#${gradId})`" />
    <polyline
      :points="linePoints"
      fill="none"
      :stroke="color"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
    <circle
      v-for="(p, i) in pts"
      :key="i"
      :cx="p.x"
      :cy="p.y"
      r="0.9"
      :fill="color"
      :opacity="i === pts.length - 1 ? 1 : 0.6"
    />
  </svg>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ data: number[]; color?: string; height?: number }>(),
  { color: "var(--accent-cyan)", height: 60 },
);

const gradId = `spark-${Math.random().toString(36).slice(2, 8)}`;

const pts = computed(() => {
  const data = props.data;
  if (!data.length) return [] as { x: number; y: number }[];
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = Math.max(max - min, 1);
  const h = props.height;
  return data.map((v, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * 100,
    y: h - ((v - min) / range) * (h - 10) - 5,
  }));
});

const linePoints = computed(() =>
  pts.value.map((p) => `${p.x},${p.y}`).join(" "),
);

const areaPoints = computed(() => {
  if (!pts.value.length) return "";
  return `0,${props.height} ${linePoints.value} 100,${props.height}`;
});
</script>
