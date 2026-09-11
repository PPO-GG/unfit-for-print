<script setup lang="ts">
/**
 * A radial-gradient halo. Deliberately not filter: blur(). Blur was the
 * single most expensive thing in the old FounderRing, and a gradient
 * reads the same at avatar sizes.
 */
import { computed } from "vue";
import type { GlowLayer } from "#shared/decorationLayers";
import { animVars } from "~/utils/decorationRender";

const props = defineProps<{ layer: GlowLayer }>();

const style = computed(() => {
  const { spread, softness, color, duration } = props.layer;
  // Where the avatar's edge falls, as a % of the glow's radius.
  const edge = 100 / (1 + 2 * spread);
  const start = edge * (1 - softness * 0.6);
  return {
    inset: `${-spread * 100}%`,
    background: `radial-gradient(circle closest-side, transparent ${start}%, ${color} ${edge}%, transparent 100%)`,
    ...animVars(duration),
  };
});
const animClass = computed(() =>
  props.layer.animation === "none" ? "" : `deco-anim-${props.layer.animation}`,
);
</script>

<template>
  <div class="deco-glow" :class="animClass" :style="style" />
</template>

<style scoped>
.deco-glow {
  position: absolute;
  border-radius: 50%;
}
</style>
