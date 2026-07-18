<!--
  Wobbling decorative stamp — used for "BETA", "LIVE", "2 LIVE" callouts.
  Animation lives in brand.css (.stamp).
-->
<template>
  <span class="stamp" :style="style">
    <slot />
  </span>
</template>

<script setup lang="ts">
import type { CSSProperties } from "vue";

defineProps<{
  style?: CSSProperties | string;
}>();
</script>
