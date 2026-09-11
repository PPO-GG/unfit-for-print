<script setup lang="ts">
/**
 * Particles on a circle (orbit/twinkle) or in a vertical band (rise/fall).
 * Orbit spins the whole container, one animation for all particles; each
 * particle's own animation (twinkle, rise, fall) lives on an inner element
 * so it never fights the positioning transform.
 */
import { computed } from "vue";
import type { ParticlesLayer } from "#shared/decorationLayers";
import { placeParticles, type ParticleSpec } from "#shared/decorationGeometry";
import { getDecorationImageUrl } from "~/utils/decorationImage";
import { animVars, SHAPE_PATHS, useAvatarPx } from "~/utils/decorationRender";

const props = defineProps<{ layer: ParticlesLayer }>();
const avatarPx = useAvatarPx();

const specs = computed(() => placeParticles(props.layer, avatarPx.value));
const radiusPx = computed(() => props.layer.radius * avatarPx.value);
const isBand = computed(() => props.layer.motion === "rise" || props.layer.motion === "fall");

const imageUrl = computed(() =>
  props.layer.shape === "image" && props.layer.asset ? getDecorationImageUrl(props.layer.asset.key) : null,
);
const path = computed(() => (props.layer.shape === "image" ? null : SHAPE_PATHS[props.layer.shape]));

const containerClass = computed(() => (props.layer.motion === "orbit" ? "deco-anim-spin" : ""));
const containerStyle = computed(() => ({
  ...animVars(props.layer.duration, props.layer.direction),
  "--deco-travel": `${radiusPx.value}px`,
}));

const innerClass = computed(() => {
  const { motion, twinkle } = props.layer;
  if (motion === "rise") return "deco-anim-rise";
  if (motion === "fall") return "deco-anim-fall";
  return twinkle || motion === "twinkle" ? "deco-anim-twinkle" : "";
});

// A twinkle cycle is much shorter than an orbit (FounderRing: ~2s vs 10s).
const innerDuration = computed(() =>
  isBand.value ? props.layer.duration : Math.min(4, Math.max(1, props.layer.duration / 5)),
);

function particleStyle(s: ParticleSpec) {
  const r = radiusPx.value;
  const rad = (s.angle * Math.PI) / 180;
  const x = isBand.value ? (s.lane - 0.5) * 2 * r : Math.cos(rad) * r;
  const y = isBand.value ? 0 : Math.sin(rad) * r;
  return {
    left: `calc(50% + ${x}px)`,
    top: `calc(50% + ${y}px)`,
    width: `${s.sizePx}px`,
    height: `${s.sizePx}px`,
    color: s.color,
  };
}

function innerStyle(s: ParticleSpec) {
  const dur = innerDuration.value;
  return animVars(dur, undefined, isBand.value ? s.delay : s.delay % dur);
}
</script>

<template>
  <div class="deco-particles" :class="containerClass" :style="containerStyle">
    <div v-for="(s, i) in specs" :key="i" class="deco-particles__p" :style="particleStyle(s)">
      <div class="deco-particles__inner" :class="innerClass" :style="innerStyle(s)">
        <img v-if="imageUrl" :src="imageUrl" alt="" draggable="false" class="deco-particles__art" />
        <svg v-else-if="path" class="deco-particles__art" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path :d="path" />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.deco-particles {
  position: absolute;
  inset: 0;
}
.deco-particles__p {
  position: absolute;
  transform: translate(-50%, -50%);
}
.deco-particles__inner,
.deco-particles__art {
  display: block;
  width: 100%;
  height: 100%;
  max-width: none; /* Tailwind preflight would clamp images */
}
</style>
