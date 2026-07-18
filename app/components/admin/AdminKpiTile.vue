<!--
  KPI tile used on the overview grid. Shows label, big value, delta
  pill, sub-line, and a sparkline ribbon.
-->
<template>
  <div :class="['kpi', kpi.color]">
    <div class="kpi-label">{{ kpi.label }}</div>
    <div class="kpi-value">{{ kpi.value }}</div>
    <div>
      <span :class="['kpi-trend', { down: !kpi.up }]">
        <AdminIcon :name="kpi.up ? 'arrow_up' : 'arrow_down'" :size="11" />
        {{ kpi.trend }}
      </span>
      <span class="kpi-sub">{{ kpi.sub }}</span>
    </div>
    <div class="kpi-spark">
      <AdminSparkline :data="sparkData" :color="sparkColor" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AdminKpi } from "~/types/admin";

const props = defineProps<{
  kpi: AdminKpi;
  sparkData: readonly number[];
}>();

const sparkColor = computed<string>(() => {
  switch (props.kpi.color) {
    case "lime": return "var(--accent-4)";
    case "cyan": return "var(--accent-3)";
    case "pink": return "var(--accent-2)";
    case "danger": return "var(--danger)";
    default: return "var(--accent)";
  }
});
</script>
