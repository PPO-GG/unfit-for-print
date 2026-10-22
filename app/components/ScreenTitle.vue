<template>
  <header
    ref="root"
    class="screen-title lobby-tokens"
    :style="{ paddingLeft: `${clearance}px` }"
  >
    <h1 class="screen-title__heading">{{ title }}</h1>
    <p v-if="subtitle" class="screen-title__subtitle">{{ subtitle }}</p>
    <slot />
  </header>
</template>

<script lang="ts" setup>
import { computed, inject, useTemplateRef } from "vue";
import { useElementBounding, useWindowScroll } from "@vueuse/core";
import { BACK_BUTTON_EDGES, titleClearance } from "~/composables/useBreadcrumbBack";

// Game-styled page heading. When it starts on the same row as the layout's
// fixed back button, it pads itself past the button's right edge.
defineProps<{ title: string; subtitle?: string }>();

const backEdges = inject(BACK_BUTTON_EDGES, null);
const root = useTemplateRef("root");
const { left, top } = useElementBounding(root);
const { y: scrollY } = useWindowScroll();
const clearance = computed(() =>
  titleClearance(backEdges?.value ?? null, { left: left.value, top: top.value + scrollY.value }),
);
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
