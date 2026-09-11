<script setup lang="ts">
/**
 * Renders a layer stack around the slotted avatar: behind layers, the avatar,
 * then front layers. Measures the avatar once and provides the size to every
 * layer (replacing the three copy-pasted ResizeObservers of the old
 * components). The footprint is the avatar box; layers overflow it.
 */
import { computed, defineAsyncComponent, onMounted, onUnmounted, provide, ref, type Component } from "vue";
import type { DecorationLayers, Layer, LayerType } from "#shared/decorationLayers";
import { AVATAR_PX_KEY } from "~/utils/decorationRender";
import DecoLayerGlow from "./DecoLayerGlow.vue";
import DecoLayerRing from "./DecoLayerRing.vue";
import DecoLayerParticles from "./DecoLayerParticles.vue";
import DecoLayerImage from "./DecoLayerImage.vue";

const props = defineProps<{ layers?: DecorationLayers | null }>();

// dotlottie pulls in a WASM runtime; only load it when a stack actually has one.
const DecoLayerLottie = defineAsyncComponent(() => import("./DecoLayerLottie.vue"));

const RENDERERS: Record<LayerType, Component> = {
  glow: DecoLayerGlow,
  ring: DecoLayerRing,
  particles: DecoLayerParticles,
  image: DecoLayerImage,
  lottie: DecoLayerLottie,
};

const avatarEl = ref<HTMLElement | null>(null);
const avatarPx = ref(48);
provide(AVATAR_PX_KEY, avatarPx);

let observer: ResizeObserver | null = null;
onMounted(() => {
  const measure = () => {
    const w = avatarEl.value?.offsetWidth;
    if (w && w > 0) avatarPx.value = w;
  };
  measure();
  if (typeof ResizeObserver !== "undefined" && avatarEl.value) {
    observer = new ResizeObserver(measure);
    observer.observe(avatarEl.value);
  }
});
onUnmounted(() => observer?.disconnect());

const shown = computed(() =>
  (props.layers?.layers ?? []).filter((l) => l.visible && l.type in RENDERERS),
);
const behind = computed(() => shown.value.filter((l) => l.side === "behind"));
const front = computed(() => shown.value.filter((l) => l.side === "front"));

const layerStyle = (l: Layer) => ({
  opacity: l.opacity,
  mixBlendMode: l.blend === "normal" ? undefined : l.blend,
});
</script>

<template>
  <div class="deco-stack">
    <div
      v-for="layer in behind"
      :key="layer.id"
      class="deco-stack__layer deco-stack__layer--behind"
      :class="{ 'deco-stack__layer--clip': layer.clip }"
      :style="layerStyle(layer)"
      :data-layer-id="layer.id"
      :data-layer-type="layer.type"
    >
      <component :is="RENDERERS[layer.type]" :layer="layer" />
    </div>

    <div ref="avatarEl" class="deco-stack__avatar">
      <slot />
    </div>

    <div
      v-for="layer in front"
      :key="layer.id"
      class="deco-stack__layer deco-stack__layer--front"
      :class="{ 'deco-stack__layer--clip': layer.clip }"
      :style="layerStyle(layer)"
      :data-layer-id="layer.id"
      :data-layer-type="layer.type"
    >
      <component :is="RENDERERS[layer.type]" :layer="layer" />
    </div>
  </div>
</template>

<style scoped>
.deco-stack {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.deco-stack__avatar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}
.deco-stack__layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.deco-stack__layer--behind { z-index: 1; }
.deco-stack__layer--front { z-index: 3; }
.deco-stack__layer--clip {
  border-radius: 50%;
  overflow: hidden;
}
</style>
