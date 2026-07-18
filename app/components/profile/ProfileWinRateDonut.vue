<!--
  Circular progress donut displaying the player's all-time win rate.
  The SVG is rotated -90deg via CSS so strokeDashoffset starts at 12
  o'clock.
-->
<template>
  <div class="wr-donut">
    <svg width="120" height="120" aria-hidden="true">
      <circle
        cx="60"
        cy="60"
        :r="radius"
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        stroke-width="10"
      />
      <circle
        cx="60"
        cy="60"
        :r="radius"
        fill="none"
        stroke="var(--accent-cyan)"
        stroke-width="10"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
        stroke-linecap="round"
        style="filter: drop-shadow(0 0 6px var(--accent-cyan))"
      />
    </svg>
    <div class="center">
      <div class="pct">{{ pct }}%</div>
      <div class="lbl">Win Rate</div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ pct?: number }>(), { pct: 0 });

const radius = 52;
const circumference = 2 * Math.PI * radius;
const offset = computed(
  () => circumference * (1 - Math.min(Math.max(props.pct, 0), 100) / 100),
);
</script>
