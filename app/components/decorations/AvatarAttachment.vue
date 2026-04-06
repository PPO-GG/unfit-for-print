<!--
  AvatarAttachment.vue — Generic image-overlay decoration renderer.

  Renders any PNG/WebP image (hat, glasses, badge, frame, etc.) positioned
  relative to the slotted avatar. All positioning is data-driven via the
  `attachment` prop — no per-decoration component needed.

  Architecture contract:
  • Same ResizeObserver measurement pattern as _DecorationTemplate.vue
  • Position via CSS transform (translate + scale + rotate)
  • z-layer: 'above' = z-3, 'below' = z-1
  • pointer-events: none on the image overlay
-->

<template>
  <div class="avatar-attachment">
    <!-- LAYER: Below avatar (z-1) — for decorations that go behind -->
    <div
      v-if="attachment.zLayer === 'below'"
      class="avatar-attachment__overlay avatar-attachment__overlay--below"
      :class="{ 'avatar-attachment__overlay--clipped': attachment.clipped }"
    >
      <img
        :src="imageUrl"
        :style="imageStyle"
        class="avatar-attachment__image"
        alt=""
        draggable="false"
      />
    </div>

    <!-- LAYER: Avatar slot (z-2) -->
    <div ref="avatarEl" class="avatar-attachment__avatar">
      <slot />
    </div>

    <!-- LAYER: Above avatar (z-3) — for hats, glasses, etc. -->
    <div
      v-if="attachment.zLayer === 'above'"
      class="avatar-attachment__overlay avatar-attachment__overlay--above"
      :class="{ 'avatar-attachment__overlay--clipped': attachment.clipped }"
    >
      <img
        :src="imageUrl"
        :style="imageStyle"
        class="avatar-attachment__image"
        alt=""
        draggable="false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { AttachmentConfig } from "~/types/decoration";

const props = defineProps<{
  imageUrl: string;
  attachment: AttachmentConfig;
}>();

// ─── Avatar Measurement ──────────────────────────────────────────────
const avatarEl = ref<HTMLElement | null>(null);
const avatarPx = ref(48);
let observer: ResizeObserver | null = null;

onMounted(() => {
  if (!avatarEl.value) return;
  const measure = () => {
    const w = avatarEl.value?.offsetWidth;
    if (w && w > 0) avatarPx.value = w;
  };
  measure();
  observer = new ResizeObserver(measure);
  observer.observe(avatarEl.value);
});
onUnmounted(() => observer?.disconnect());

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

// ─── Computed Image Style ───────────────────────────────────────────
const imageStyle = computed(() => {
  const { offsetX, offsetY, scale, rotation } = props.attachment;
  const anchor = anchorPosition.value;

  // Convert fractional offsets to pixel values based on avatar size
  const px = avatarPx.value;
  const ox = offsetX * px;
  const oy = offsetY * px;

  // Image size is scale × avatar size
  const imgSize = Math.round(px * scale);

  return {
    position: "absolute" as const,
    top: anchor.top,
    left: anchor.left,
    width: `${imgSize}px`,
    height: `${imgSize}px`,
    transform: `translate(${anchor.translateBase}) translate(${ox}px, ${oy}px) rotate(${rotation}deg)`,
  };
});
</script>

<style scoped>
@keyframes avatar-attachment-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.avatar-attachment {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  animation: avatar-attachment-fade-in 0.4s ease-out;
}

.avatar-attachment__avatar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-attachment__overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.avatar-attachment__overlay--below {
  z-index: 1;
}

.avatar-attachment__overlay--above {
  z-index: 3;
}

.avatar-attachment__overlay--clipped {
  border-radius: 50%;
  overflow: hidden;
}

.avatar-attachment__image {
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  max-width: none; /* Override Tailwind preflight's img { max-width: 100% } which would clamp scale > 1 */
}
</style>
