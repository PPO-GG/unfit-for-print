<!--
╔══════════════════════════════════════════════════════════════════════╗
║  AVATAR DECORATION TEMPLATE                                        ║
║                                                                    ║
║  Copy this file, rename to your decoration (PascalCase), and       ║
║  customise the visual layers below.                                ║
║                                                                    ║
║  INTEGRATION CHECKLIST:                                            ║
║  1. Copy & rename:  decorations/MyDecoration.vue                   ║
║  2. Register in:    app/utils/decorations.ts                       ║
║       "my-decoration": {                                           ║
║         component: () => import("~/components/decorations/         ║
║                                  MyDecoration.vue"),               ║
║       },                                                           ║
║                                                                    ║
║  ARCHITECTURE CONTRACT:                                            ║
║  • The <slot> receives the avatar element (UAvatar, img, etc.)     ║
║  • All sizes are DERIVED from the measured avatar — never hardcode ║
║  • Use z-index layering:                                           ║
║      z-0  glow / ambient background effects                       ║
║      z-1  border / ring                                            ║
║      z-2  avatar (the slot content)                                ║
║      z-3+ overlay effects (particles, sparkles, etc.)              ║
║  • Prefix all CSS classes & keyframes with your decoration name    ║
║    to avoid collisions (scoped CSS handles most, but keyframe      ║
║    names can still leak in some bundler configs).                   ║
╚══════════════════════════════════════════════════════════════════════╝
-->

<template>
  <div class="my-decoration">
    <!--
      LAYER 0: GLOW / AMBIENT EFFECT
      A soft blurred background that sits behind everything.
      Adjust inset, color, blur, and animation to taste.
    -->
    <div class="my-decoration__glow" />

    <!--
      LAYER 1: BORDER / RING
      A decorative ring around the avatar. Uses inline styles driven
      by computed values so it scales with the avatar size.
      For conic-gradient rings, use the border-box trick from FounderRing.
      For solid rings, a simple border + border-radius works.
    -->
    <div
      class="my-decoration__border"
      :style="{ borderWidth: `${borderPx}px`, inset: `-${borderPx}px` }"
    />

    <!--
      LAYER 2: AVATAR (slot)
      Always wrapped in a flex container with z-index above the ring/glow.
      The ref is used by ResizeObserver to measure the avatar.
    -->
    <div ref="avatarEl" class="my-decoration__avatar">
      <slot />
    </div>

    <!--
      LAYER 3+: OVERLAY EFFECTS (particles, sparkles, orbits, etc.)
      These float above the avatar. Use pointer-events: none so clicks
      pass through to the avatar/button beneath.

      Example patterns:
      • Orbiting particles (see FounderRing __orbit + __sparkle)
      • Static corner badges
      • Pulsing rings
      • Floating icons

      Delete this section entirely if your decoration has no overlays.
    -->
    <div class="my-decoration__effects">
      <!--
        Example: a simple pulsing ring overlay
        Replace with your own particle/effect markup.
      -->
      <div class="my-decoration__pulse-ring" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";

// ─── Avatar Measurement ──────────────────────────────────────────────
// ResizeObserver ensures the decoration adapts when the avatar is
// rendered at different sizes (profile page = 96px, header = 32px, etc.)

const avatarEl = ref<HTMLElement | null>(null);
const avatarPx = ref(48); // sensible default until measured
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

// ─── Derived Visual Values ───────────────────────────────────────────
// All sizes should be derived from avatarPx so the decoration scales
// proportionally. Use Math.max() to set sensible minimums.

/** Border thickness — proportional to avatar size, minimum 2px */
const borderPx = computed(() => Math.max(2, Math.round(avatarPx.value * 0.03)));

/**
 * Particle/effect base size — uses sqrt scaling to prevent oversized
 * effects on large avatars while staying visible on small ones.
 * Adjust the multiplier (0.5) and offset (2) to taste.
 */
const _effectBasePx = computed(() => 2 + Math.sqrt(avatarPx.value) * 0.5);

/**
 * Number of particles/effects — scale with avatar size so small
 * avatars aren't cluttered and large ones aren't sparse.
 * Delete if your decoration doesn't use particles.
 */
function _effectCount(size: number): number {
  if (size < 40) return 2;
  if (size < 80) return 4;
  if (size < 140) return 6;
  return 8;
}
</script>

<style scoped>
/*
 * ─── KEYFRAMES ────────────────────────────────────────────────────────
 * Prefix with your decoration name to avoid collisions.
 */

@keyframes my-decoration-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes my-decoration-pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.05);
  }
}

@keyframes my-decoration-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/*
 * ─── ROOT ─────────────────────────────────────────────────────────────
 * inline-flex keeps the decoration tightly wrapped around the avatar.
 */
.my-decoration {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  animation: my-decoration-fade-in 0.4s ease-out;
}

/*
 * ─── LAYER 0: GLOW ───────────────────────────────────────────────────
 * Adjust color, spread (inset), and blur to match your theme.
 */
.my-decoration__glow {
  position: absolute;
  inset: -12%;
  border-radius: 50%;
  /* CUSTOMISE: change rgba color to match your decoration theme */
  background: rgba(99, 102, 241, 0.2);
  filter: blur(12px);
  animation: my-decoration-pulse 4s ease-in-out infinite;
}

/*
 * ─── LAYER 1: BORDER / RING ──────────────────────────────────────────
 * borderWidth and inset are set via inline :style for responsiveness.
 *
 * Option A — Conic gradient ring (like FounderRing):
 *   background:
 *     linear-gradient(#020617, #020617) padding-box,
 *     conic-gradient(from 0deg, #color1, #color2, ...) border-box;
 *   animation: my-decoration-spin 6s linear infinite;
 *
 * Option B — Solid colour ring:
 *   border-color: #your-color;
 */
.my-decoration__border {
  position: absolute;
  border-radius: 50%;
  border-style: solid;
  border-color: transparent;
  /* CUSTOMISE: replace gradient colours */
  background:
    linear-gradient(#020617, #020617) padding-box,
    conic-gradient(
        from 0deg,
        #6366f1,
        #a78bfa,
        #818cf8,
        #c4b5fd,
        #a78bfa,
        #6366f1
      )
      border-box;
  animation: my-decoration-spin 6s linear infinite;
  z-index: 1;
}

/*
 * ─── LAYER 2: AVATAR ─────────────────────────────────────────────────
 * Don't modify this section — it's the standardised avatar container.
 */
.my-decoration__avatar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

/*
 * ─── LAYER 3: OVERLAY EFFECTS ────────────────────────────────────────
 * Floats above the avatar. pointer-events: none is essential so
 * the user can still click the avatar or its parent button.
 */
.my-decoration__effects {
  position: absolute;
  inset: -20%;
  z-index: 3;
  pointer-events: none;
}

/* Example: a pulsing ring overlay — replace with your own effects */
.my-decoration__pulse-ring {
  position: absolute;
  inset: 10%;
  border-radius: 50%;
  /* CUSTOMISE: ring colour */
  border: 1px solid rgba(99, 102, 241, 0.3);
  animation: my-decoration-pulse 3s ease-in-out infinite;
}
</style>
