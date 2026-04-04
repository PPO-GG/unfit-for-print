<script setup lang="ts">
import { computed, defineAsyncComponent, type Component } from "vue";
import type { DecorationSize } from "~/types/decoration";
import { decorationRegistry } from "~/utils/decorations";

const props = defineProps<{
  decorationId?: string | null;
  size?: DecorationSize;
}>();

const decorationComponent = computed<Component | null>(() => {
  if (!props.decorationId) return null;
  const entry = decorationRegistry[props.decorationId];
  if (!entry) return null;
  return defineAsyncComponent(() =>
    entry.component().then((mod) => mod.default),
  );
});
</script>

<template>
  <component
    :is="decorationComponent"
    v-if="decorationComponent"
    :size="size"
  >
    <slot />
  </component>
  <slot v-else />
</template>
