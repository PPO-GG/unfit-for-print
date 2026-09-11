<script setup lang="ts">
/**
 * A PNG/WebP/GIF/SVG positioned by the layer transform. The idle animation
 * sits on the <img>, not the positioned box, so it composes with the
 * transform instead of overwriting it. SVG renders through <img>, so any
 * script inside it never runs.
 */
import { computed } from "vue";
import type { ImageLayer } from "#shared/decorationLayers";
import { getDecorationImageUrl } from "~/utils/decorationImage";
import { animVars, transformStyle, useAvatarPx } from "~/utils/decorationRender";

const props = defineProps<{ layer: ImageLayer }>();
const avatarPx = useAvatarPx();

const src = computed(() => (props.layer.asset ? getDecorationImageUrl(props.layer.asset.key) : null));
const boxStyle = computed(() => transformStyle(props.layer.transform, avatarPx.value));
const idleClass = computed(() => (props.layer.idle === "none" ? "" : `deco-anim-${props.layer.idle}`));
const idleVars = computed(() => animVars(props.layer.duration));
</script>

<template>
  <div v-if="src" :style="boxStyle">
    <img :src="src" alt="" draggable="false" class="deco-image" :class="idleClass" :style="idleVars" />
  </div>
</template>

<style scoped>
.deco-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  max-width: none; /* Tailwind preflight would clamp scale > 1 */
  user-select: none;
}
</style>
