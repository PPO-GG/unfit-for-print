<!--
  AvatarLottie.vue — Animated Lottie/dotLottie decoration renderer.

  Renders a Lottie or dotLottie animation positioned relative to the
  slotted avatar. Uses the same positioning system as AvatarAttachment
  (anchor, offset, scale, rotation, zLayer, clipped) but renders to
  a <canvas> via @lottiefiles/dotlottie-web instead of an <img>.

  Architecture contract:
  • Same ResizeObserver measurement pattern as AvatarAttachment.vue
  • Position via CSS transform (translate + scale + rotate)
  • z-layer: 'above' = z-3, 'below' = z-1
  • pointer-events: none on the canvas overlay
  • Always loops, always autoplays
-->

<template>
  <div ref="rootEl" class="avatar-lottie">
    <!-- LAYER: Below avatar (z-1) -->
    <div
      v-if="attachment.zLayer === 'below'"
      class="avatar-lottie__overlay avatar-lottie__overlay--below"
      :class="{ 'avatar-lottie__overlay--clipped': attachment.clipped }"
    >
      <canvas ref="canvasBelowEl" :width="imgSize" :height="imgSize" :style="canvasStyle" class="avatar-lottie__canvas" />
    </div>

    <!-- LAYER: Avatar slot (z-2) -->
    <div ref="avatarEl" class="avatar-lottie__avatar">
      <slot />
    </div>

    <!-- LAYER: Above avatar (z-3) -->
    <div
      v-if="attachment.zLayer === 'above'"
      class="avatar-lottie__overlay avatar-lottie__overlay--above"
      :class="{ 'avatar-lottie__overlay--clipped': attachment.clipped }"
    >
      <canvas ref="canvasAboveEl" :width="imgSize" :height="imgSize" :style="canvasStyle" class="avatar-lottie__canvas" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { DotLottie } from "@lottiefiles/dotlottie-web";
import type { AttachmentConfig } from "~/types/decoration";

const props = defineProps<{
  imageUrl: string;
  attachment: AttachmentConfig;
}>();

// ─── Avatar Measurement ──────────────────────────────────────────────
const rootEl = ref<HTMLElement | null>(null);
const avatarEl = ref<HTMLElement | null>(null);
const canvasBelowEl = ref<HTMLCanvasElement | null>(null);
const canvasAboveEl = ref<HTMLCanvasElement | null>(null);
const avatarPx = ref(48);
let resizeObserver: ResizeObserver | null = null;
let intersectionObserver: IntersectionObserver | null = null;

// ─── DotLottie Instance ─────────────────────────────────────────────
let dotLottie: DotLottie | null = null;

const activeCanvas = computed(() =>
  props.attachment.zLayer === "below" ? canvasBelowEl.value : canvasAboveEl.value,
);

function initDotLottie() {
  const canvas = activeCanvas.value;
  if (!canvas || dotLottie) return;
  dotLottie = new DotLottie({
    canvas,
    src: props.imageUrl,
    autoplay: true,
    loop: true,
    speed: props.attachment.speed ?? 1,
    renderConfig: {
      // Cap at 1x — prevents 2-3x overdraw on HiDPI displays.
      devicePixelRatio: 1,
      // Let dotlottie handle canvas resizes internally — safe now that we
      // bind :width/:height so the initial buffer allocation is correct.
      autoResize: true,
    },
  });
}

function destroyDotLottie() {
  if (dotLottie) {
    dotLottie.destroy();
    dotLottie = null;
  }
}

onMounted(() => {
  if (avatarEl.value) {
    const measure = () => {
      const w = avatarEl.value?.offsetWidth;
      if (w && w > 0) avatarPx.value = w;
    };
    measure();
    resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(avatarEl.value);
  }

  // Defer WASM init until the element is visible — avoids booting multiple
  // DotLottie instances simultaneously when many decorations render off-screen.
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        initDotLottie();
        intersectionObserver?.disconnect();
        intersectionObserver = null;
      }
    },
    { rootMargin: "100px" },
  );
  if (rootEl.value) intersectionObserver.observe(rootEl.value);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  intersectionObserver?.disconnect();
  destroyDotLottie();
});

// Reload animation when source URL changes
watch(() => props.imageUrl, () => {
  destroyDotLottie();
  initDotLottie();
});

// Reinitialize when zLayer changes (v-if switches the active canvas)
watch(activeCanvas, (newCanvas) => {
  if (!newCanvas) return;
  destroyDotLottie();
  initDotLottie();
});

// Update playback speed without reinitializing
watch(() => props.attachment.speed, (s) => dotLottie?.setSpeed(s ?? 1));

// ─── Anchor → CSS Position Mapping ──────────────────────────────────
const anchorPosition = computed(() => {
  switch (props.attachment.anchor) {
    case "top-left":
      return { top: "0%", left: "0%", translateBase: "-50%, -50%" };
    case "top-center":
      return { top: "0%", left: "50%", translateBase: "-50%, -50%" };
    case "top-right":
      return { top: "0%", left: "100%", translateBase: "-50%, -50%" };
    case "center":
      return { top: "50%", left: "50%", translateBase: "-50%, -50%" };
    case "bottom-center":
      return { top: "100%", left: "50%", translateBase: "-50%, -50%" };
    default:
      return { top: "0%", left: "50%", translateBase: "-50%, -50%" };
  }
});

// ─── Computed Canvas Size ───────────────────────────────────────────
// Computed separately so canvas width/height attributes stay in sync with
// the WASM buffer allocation — prevents dotlottie buffer size mismatch.
const imgSize = computed(() => Math.round(avatarPx.value * props.attachment.scale));

// ─── Computed Canvas Style ──────────────────────────────────────────
const canvasStyle = computed(() => {
  const { offsetX, offsetY, rotation } = props.attachment;
  const anchor = anchorPosition.value;
  const px = avatarPx.value;
  const ox = offsetX * px;
  const oy = offsetY * px;
  const size = imgSize.value;

  return {
    position: "absolute" as const,
    top: anchor.top,
    left: anchor.left,
    width: `${size}px`,
    height: `${size}px`,
    transform: `translate(${anchor.translateBase}) translate(${ox}px, ${oy}px) rotate(${rotation}deg)`,
  };
});
</script>

<style scoped>
@keyframes avatar-lottie-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.avatar-lottie {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  animation: avatar-lottie-fade-in 0.4s ease-out;
}

.avatar-lottie__avatar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-lottie__overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.avatar-lottie__overlay--below { z-index: 1; }
.avatar-lottie__overlay--above { z-index: 3; }

.avatar-lottie__overlay--clipped {
  border-radius: 50%;
  overflow: hidden;
}

.avatar-lottie__canvas {
  pointer-events: none;
  user-select: none;
}
</style>
