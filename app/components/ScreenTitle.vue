<template>
  <header ref="root" class="screen-title lobby-tokens" :style="clearanceStyle">
    <h1 class="screen-title__heading">{{ title }}</h1>
    <p v-if="subtitle" class="screen-title__subtitle">{{ subtitle }}</p>
  </header>
</template>

<script lang="ts" setup>
import { computed, useTemplateRef } from "vue";
import { useElementBounding } from "@vueuse/core";

// Game-styled page heading. When it starts under the layout's fixed back
// button, it pads itself past the button's right edge, which the layout
// publishes as --screen-back-right. A wide centred page needs no padding.
defineProps<{ title: string; subtitle?: string }>();

const root = useTemplateRef("root");
const { left } = useElementBounding(root);
const clearanceStyle = computed(() => ({
  paddingLeft: `max(0px, calc(var(--screen-back-right, 8.5rem) + 0.75rem - ${left.value}px))`,
}));
</script>

<style scoped>
.screen-title {
  min-width: 0;
  min-height: 44px;
}

.screen-title__heading {
  font-family: 'Archivo Black', sans-serif;
  font-size: clamp(1.5rem, 4vw, 2.5rem);
  line-height: 1.05;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--lb-ink);
  overflow-wrap: anywhere;
}

.screen-title__subtitle {
  margin-top: 0.375rem;
  color: var(--lb-ink-dim);
}
</style>
