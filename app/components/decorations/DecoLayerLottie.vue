<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { DotLottie } from "@lottiefiles/dotlottie-web";
import type { LottieLayer } from "#shared/decorationLayers";
import { getDecorationImageUrl } from "~/utils/decorationImage";
import { transformStyle, useAvatarPx } from "~/utils/decorationRender";

const props = defineProps<{ layer: LottieLayer }>();
const avatarPx = useAvatarPx();
const canvasEl = ref<HTMLCanvasElement | null>(null);

const src = computed(() => (props.layer.asset ? getDecorationImageUrl(props.layer.asset.key) : null));
const boxStyle = computed(() => transformStyle(props.layer.transform, avatarPx.value));
// Bound to the canvas attributes so the WASM buffer is allocated at the right size.
const size = computed(() => Math.max(1, Math.round(avatarPx.value * props.layer.transform.scale)));

let player: DotLottie | null = null;
let io: IntersectionObserver | null = null;

function start() {
  if (!canvasEl.value || !src.value || player) return;
  player = new DotLottie({
    canvas: canvasEl.value,
    src: src.value,
    autoplay: true,
    loop: true,
    speed: props.layer.speed,
    // Cap at 1x: prevents 2-3x overdraw on HiDPI with many avatars on screen.
    renderConfig: { devicePixelRatio: 1, autoResize: true },
  });
}

function stop() {
  player?.destroy();
  player = null;
}

onMounted(() => {
  // Defer the WASM boot until visible; most decorated avatars start off-screen.
  if (typeof IntersectionObserver === "undefined") return start();
  io = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        start();
        io?.disconnect();
        io = null;
      }
    },
    { rootMargin: "100px" },
  );
  if (canvasEl.value) io.observe(canvasEl.value);
});

onUnmounted(() => {
  io?.disconnect();
  stop();
});

watch(src, async () => {
  stop();
  await nextTick(); // the canvas is v-if'd on src
  start();
});
watch(() => props.layer.speed, (s) => player?.setSpeed(s));
</script>

<template>
  <div v-if="src" :style="boxStyle">
    <canvas ref="canvasEl" :width="size" :height="size" class="deco-lottie" />
  </div>
</template>

<style scoped>
.deco-lottie {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
