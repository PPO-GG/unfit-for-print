<script setup lang="ts">
/**
 * A stroke around the avatar. The fill is painted on a full disc and a
 * radial mask cuts the centre out, so the ring is transparent inside (the
 * old FounderRing painted #020617 there and only worked on dark grounds).
 * Dashes intersect a repeating-conic mask with the ring mask.
 */
import { computed } from "vue";
import type { RingLayer } from "#shared/decorationLayers";
import { strokePx } from "#shared/decorationGeometry";
import { animVars, useAvatarPx } from "~/utils/decorationRender";

const props = defineProps<{ layer: RingLayer }>();
const avatarPx = useAvatarPx();

const DASH_MASK = {
  dashed: "repeating-conic-gradient(#000 0deg 10deg, transparent 10deg 15deg)",
  dotted: "repeating-conic-gradient(#000 0deg 3deg, transparent 3deg 8deg)",
} as const;

function fillCss(l: RingLayer): string {
  const f = l.fill;
  if (f.kind === "solid") return f.color;
  const stops = f.stops.join(", ");
  return f.kind === "conic"
    ? `conic-gradient(from ${f.angle}deg, ${stops})`
    : `linear-gradient(${f.angle}deg, ${stops})`;
}

const style = computed(() => {
  const l = props.layer;
  const w = strokePx(avatarPx.value, l.thickness);
  const gap = Math.round(l.gap * avatarPx.value);
  const ring = `radial-gradient(farthest-side, transparent calc(100% - ${w}px), #000 calc(100% - ${w}px))`;
  const mask = l.dash === "none" ? ring : `${ring}, ${DASH_MASK[l.dash]}`;
  return {
    inset: `${-(gap + w)}px`,
    background: fillCss(l),
    mask,
    WebkitMask: mask,
    ...(l.dash === "none" ? {} : { maskComposite: "intersect", WebkitMaskComposite: "source-in" }),
    ...animVars(l.duration, l.direction),
  };
});
const animClass = computed(() =>
  props.layer.animation === "none" ? "" : `deco-anim-${props.layer.animation}`,
);
</script>

<template>
  <div class="deco-ring" :class="animClass" :style="style" />
</template>

<style scoped>
.deco-ring {
  position: absolute;
  border-radius: 50%;
}
</style>
