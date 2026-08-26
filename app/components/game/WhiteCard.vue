<template>
  <div
    v-bind="$attrs"
    class="card-scaler select-none justify-center flex items-center aspect-[3/4] hover:z-[100]"
    :class="flat ? '' : 'perspective-[800px]'"
    :style="{ '--card-scale': scale / 100 }"
  >
    <div
      ref="card"
      :class="[
        flat ? 'card--flat' : 'card--3d',
        { 'card--flipped': flipped, 'card--winner': isWinner },
      ]"
      class="card cursor-pointer"
      @mouseleave="resetTransform"
      @mousemove="handleMouseMove"
      @click="$emit('click')"
    >
      <div
        class="card__inner cursor-pointer"
        :class="flat ? 'card__inner--flat' : 'card__inner--3d'"
      >
        <!-- Front Side (3D mode: always rendered, hidden by backface-visibility;
             Flat mode: only rendered when not flipped) -->
        <div
          v-if="!flat || !flipped"
          class="card__face card__front cursor-pointer"
        >
          <slot name="front">
            <div class="card-content cursor-pointer">
              <div class="card-spine" />
              <span class="card-spine-label" aria-hidden="true">UNFIT · FOR · PRINT</span>
              <div class="card-body">
                <p class="card-body-text text-pretty cursor-pointer">{{ cardText }}</p>
              </div>
              <img
                class="card-watermark"
                src="/img/unfit_logo_alt_dark.png"
                alt=""
                aria-hidden="true"
                draggable="false"
              />
              <div class="card-footer">
                <span class="card-footer-pack">{{ cardPack || '' }}</span>
              </div>
              <div class="card-report-btn" @click.stop>
                <UPopover
                  :ui="{ content: 'w-full backdrop-blur-sm bg-slate-900/50 rounded-lg' }"
                  arrow
                >
                  <span class="flex cursor-pointer">⋯</span>
                  <template #content>
                    <div class="flex-1 p-4">
                      <p class="text-md p-1">
                        <span class="text-yellow-500">Card ID: </span>{{ cardId ?? '' }}
                      </p>
                      <p class="text-md p-1">
                        <span class="text-yellow-500">Card Pack: </span>{{ cardPack }}
                      </p>
                      <UButton
                        class="mt-2"
                        color="warning"
                        label="Report This Card"
                        variant="subtle"
                        @click.stop="showReportModal = true"
                      />
                    </div>
                  </template>
                </UPopover>
              </div>
            </div>
          </slot>
        </div>

        <!-- Back Side (3D mode: always rendered, shown via rotateY(180deg);
             Flat mode: only rendered when flipped) -->
        <div
          v-if="!flat || flipped"
          class="card__face card__back cursor-pointer"
        >
          <slot name="back">
            <div class="card-content cursor-pointer">
              <div class="card-spine" />
              <span class="card-spine-label" aria-hidden="true">UNFIT · FOR · PRINT</span>
              <div class="card-back-logo-wrap">
                <img
                  class="card-back-logo-img"
                  src="/img/unfit_logo_alt_dark.png"
                  alt="Unfit For Print"
                  draggable="false"
                />
              </div>
              <div class="card-back-footer">
                <span>ED. 001 · ANSWERS</span>
                <span class="card-back-footer-mark">✶ 18+</span>
              </div>
            </div>
          </slot>
          <div v-if="shine" :style="shineStyle" class="card__shine"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Report Card Modal -->
  <UModal
    v-model:open="showReportModal"
    :title="'Report A Card'"
    aria-describedby="Report A Card"
    :description="'Please select a reason for reporting this card:'"
  >
    <template #body>
      <ReportCard
        :card-id="cardId || ''"
        card-type="white"
        @cancel="showReportModal = false"
        @submit="showReportModal = false"
      />
    </template>
  </UModal>
</template>

<script lang="ts" setup>
import { gsap } from "gsap";
import { computed } from "vue";

defineOptions({
  inheritAttrs: false,
});

import ReportCard from "~/components/ReportCard.vue";
import { SFX } from "~/config/sfx.config";

// Define emits to fix the warning about extraneous non-emits event listeners
defineEmits(["click"]);

const { getRandomInRange } = useCrypto();
const { playSfx } = useSfx();
const { vibrate } = useVibrate({
  pattern: [30, 20, 30],
  interval: 0,
});
const { isMobile } = useDevice();

function playRandomFlip() {
  vibrate();
  playSfx(SFX.cardFlip, { volume: 0.75, pitch: [0.95, 1.05] });
}

const props = withDefaults(defineProps<{
  cardId?: string;
  text?: string;
  cardPack?: string;
  backLogoUrl?: string;
  flipped?: boolean;
  threeDeffect?: boolean;
  shine?: boolean;
  maskUrl?: string;
  isWinner?: boolean;
  disableHover?: boolean;
  /** Flat rendering mode: bypasses preserve-3d entirely to avoid Firefox GPU
   *  tiling artifacts. Use for cards that never need an animated flip
   *  (e.g. hand cards, pile cards). */
  flat?: boolean;
  /** Size scale as a percentage. 100 = default size, 50 = half size, etc. */
  scale?: number;
}>(), {
  scale: 100,
});

const fallbackText = ref("");
const cardText = computed(() => props.text || fallbackText.value);
const cardPack = ref(props.cardPack || null);

// Watch for changes to the cardPack prop and update the ref
watch(
  () => props.cardPack,
  (newCardPack) => {
    cardPack.value = newCardPack || null;
  },
);

const card = ref<HTMLElement | null>(null);
const rotation = ref({ x: 0, y: 0 });
const shineOffset = ref({ x: 0, y: 0 });
const showReportModal = ref(false);

function animateShine() {
  const ease = 0.05;
  shineOffset.value.x += (rotation.value.x - shineOffset.value.x) * ease;
  shineOffset.value.y += (rotation.value.y - shineOffset.value.y) * ease;
  requestAnimationFrame(animateShine);
}

const shineStyle = computed(() => {
  const angle = (-shineOffset.value.y + shineOffset.value.x) * 2 + 45;
  const offsetX = -shineOffset.value.y + 50;
  const offsetY = -shineOffset.value.x + 50;
  return {
    background: `linear-gradient(${angle}deg, transparent, red, transparent, orange, transparent, yellow, transparent, green, transparent, cyan, transparent, blue, transparent, violet, transparent, red)`,
    backgroundPosition: `${offsetX}% ${offsetY}%`,
    backgroundSize: "500% 500%",
    mixBlendMode: "screen" as "screen",
    WebkitMaskImage: `url(${props.maskUrl})`,
    maskImage: `url(${props.maskUrl})`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "cover",
    maskSize: "cover",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    opacity: 0.25,
    transition: "background-position 250ms linear, background 250ms linear",
  };
});

function handleMouseMove(e: MouseEvent) {
  if (!card.value) return;
  if (isMobile) return;
  if (props.disableHover) return;

  const cardRect = card.value.getBoundingClientRect();
  const x = e.clientX - cardRect.left;
  const y = e.clientY - cardRect.top;
  const centerX = cardRect.width / 2;
  const centerY = cardRect.height / 2;

  const rotateX = Math.round(((y - centerY) / centerY) * 15);
  const rotateY = Math.round(((centerX - x) / centerX) * 15);

  rotation.value = { x: rotateX, y: rotateY };

  applyTransform(rotateX, rotateY);
}

function updateShadow(rotateX: number, rotateY: number, intensity: number) {
  const scaler = card.value?.parentElement as HTMLElement | null;
  if (!scaler) return;

  const rx = rotateX * intensity;
  const ry = rotateY * intensity;

  // Shadow offsets move opposite to tilt direction (light source above-center)
  const shadowX = -ry * 1.2;
  const shadowY = 8 + rx * 0.8;
  const lift = (Math.abs(rx) + Math.abs(ry)) / 2;

  // More tilt = higher elevation = softer, more opaque shadow
  const blur = 16 + lift * 1.5;
  const opacity = 0.35 + lift * 0.02;

  // Drive the ::before shadow blob via individual CSS custom properties
  scaler.style.setProperty("--shadow-x", `${shadowX.toFixed(1)}px`);
  scaler.style.setProperty("--shadow-y", `${shadowY.toFixed(1)}px`);
  scaler.style.setProperty("--shadow-blur", `${blur.toFixed(1)}px`);
  scaler.style.setProperty("--shadow-opacity", opacity.toFixed(3));
}

function applyTransform(rotateX = 0, rotateY = 0) {
  if (!card.value) return;
  const intensity = props.threeDeffect ? 1 : 0.3;

  // Only tilt the outer .card container
  card.value.style.transform = `rotateX(${rotateX * intensity}deg) rotateY(${rotateY * intensity}deg)`;

  // Simulate overhead lighting via dark overlay — brightness filter is invisible
  // on near-white surfaces, so we use an opacity-controlled black overlay instead.
  // Positive rotateX = tilting away from overhead light = darker.
  const shadowAmount = Math.max(0, -rotateX * intensity * 0.01);
  card.value.style.setProperty("--card-light-shadow", shadowAmount.toFixed(3));

  // Physical shadow tracks the tilt
  updateShadow(rotateX, rotateY, intensity);
}

function resetTransform() {
  if (card.value && !props.disableHover) {
    rotation.value = { x: 0, y: 0 };
    applyTransform(0, 0);
    card.value.style.removeProperty("--card-light-shadow");
    // Clear custom properties so CSS defaults take over
    const scaler = card.value.parentElement as HTMLElement | null;
    if (scaler) {
      scaler.style.removeProperty("--shadow-x");
      scaler.style.removeProperty("--shadow-y");
      scaler.style.removeProperty("--shadow-blur");
      scaler.style.removeProperty("--shadow-opacity");
      scaler.style.removeProperty("--shadow-scale-x");
    }
  }
}

watch(
  () => props.flipped,
  (flipped) => {
    const innerEl = card.value?.querySelector(".card__inner");
    if (!innerEl || !card.value) return;

    // Kill any in-progress flip to prevent jitter on rapid clicks
    gsap.killTweensOf(innerEl);

    const tl = gsap.timeline({ onStart: () => playRandomFlip() });

    // Main flip — single continuous rotation preserving the elastic card-flip feel
    tl.to(innerEl, {
      rotateY: flipped ? 180 : 0,
      duration: 1.5,
      ease: "elastic.out(0.2, 0.1)",
    });

    // Bend overlay — concurrent tweens that dip and recover while the flip runs
    // Quick dip: card narrows, tilts forward, and lifts as it bends mid-flip
    tl.to(
      innerEl,
      {
        scaleX: 0.82,
        rotateX: -10,
        duration: 0.2,
        ease: "power2.out",
      },
      0,
    );

    // Recovery: card springs back to flat
    tl.to(
      innerEl,
      {
        scaleX: 1,
        rotateX: 0,
        duration: 0.5,
        ease: "elastic.out(0.3, 0.15)",
      },
      0.2,
    );

    // Shadow: fade out + squeeze as card goes edge-on, then recover
    const scaler = card.value.parentElement as HTMLElement | null;
    if (scaler) {
      gsap.killTweensOf(scaler);
      // Disappear as card passes through 90°
      tl.to(
        scaler,
        {
          "--shadow-opacity": 0,
          "--shadow-scale-x": 0.1,
          duration: 0.15,
          ease: "power2.in",
        },
        0,
      );
      // Reappear as card settles face-up
      tl.to(
        scaler,
        {
          "--shadow-opacity": 0.35,
          "--shadow-scale-x": 1,
          duration: 0.5,
          ease: "power2.out",
        },
        0.2,
      );
    }
  },
);

onMounted(async () => {
  if (!props.text) {
    try {
      if (!props.cardId) {
        fallbackText.value = "CARD TEXT HERE";
        return;
      }

      // Check if the card ID is valid (should be a string with reasonable length)
      if (props.cardId.length < 20) {
        console.warn("Invalid card ID format:", props.cardId);
        fallbackText.value = "Invalid card format";
        return;
      }

      try {
        const [doc] = await $fetch<{ id: string; text: string; pack: string }[]>(
          "/api/cards/resolve",
          { method: "POST", body: { ids: [props.cardId] } },
        );

        if (doc && doc.text) {
          fallbackText.value = doc.text;
          cardPack.value = doc.pack || null;
        } else {
          console.warn(
            "Card not found or text is missing for ID:",
            props.cardId,
          );
          fallbackText.value = "This card is from another game";
        }
      } catch (docError: any) {
        console.error("Error fetching card text:", docError);

        const errorMessage =
          typeof docError === "string" ? docError : docError?.message || "";

        if (
          errorMessage.includes("Network error") ||
          errorMessage.includes("fetch")
        ) {
          fallbackText.value = "Network error - check connection";
        } else {
          fallbackText.value = "Error loading card content";
        }
      }
    } catch (error) {
      console.error("Error in card loading process:", error);
      fallbackText.value = "Unexpected error loading card";
    }
  }

  if (!props.disableHover) {
    resetTransform();
    animateShine();
  }
});
</script>

<style scoped>
/* ── Shared base styles (both 3D and flat modes) ────────────────── */
.card {
  width: 100%;
  height: 100%;
  border-radius: 14px;
  position: relative;
  transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.card--flipped:not(.card--flat) {
  transform: rotateY(180deg);
}

.card__inner {
  width: 100%;
  height: 100%;
  position: relative;
}

.card__face {
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.25rem;
  text-align: center;
  border-radius: 14px;
  z-index: 1;
}

.card__front,
.card__back {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0; left: 0;
  border-radius: 14px;
}

.card__front { background-color: #f6f3ea; }
.card__back  { background-color: #f6f3ea; }

.card__front .card__shine,
.card__back  .card__shine {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  border-radius: 14px;
}

.card__shine {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 100;
  transition: background-position 250ms linear;
  border-radius: 14px;
}

/* ══════════════════════════════════════════════════════════════════
   3D MODE
   ══════════════════════════════════════════════════════════════════ */
.card--3d {
  transform-style: preserve-3d;
  will-change: transform;
}

.card--3d .card__inner--3d {
  transform-style: preserve-3d;
  background-color: #f6f3ea;
  border-radius: 14px;
}

.card--3d .card__face {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  outline: 1px solid transparent;
  opacity: 0.999;
}

.card--3d .card__front,
.card--3d .card__back {
  outline: 1px solid transparent;
}

.card--3d .card__back {
  transform: rotateY(180deg);
}

/* ══════════════════════════════════════════════════════════════════
   FLAT MODE
   ══════════════════════════════════════════════════════════════════ */
.card--flat {
  background: #f6f3ea;
  transform-style: flat;
}

.card--flat .card__inner--flat {
  transform-style: flat;
  border-radius: 14px;
}

.card--flat .card__back {
  transform: none;
}

.card-content {
  position: relative;
  width: 100%;
  height: 100%;
  z-index: 1;
  color: #0d0f1a;
  border-radius: 14px;
  overflow: hidden;
  filter: blur(0);
}

/* Overhead-light simulation (retained from prior design) */
.card-content::before {
  content: "";
  position: absolute;
  inset: 0;
  background: black;
  opacity: var(--card-light-shadow, 0);
  pointer-events: none;
  z-index: 5;
  border-radius: 14px;
  transition: opacity 0.15s ease-out;
}

.card-scaler {
  --card-scale: 1;
  width: clamp(
    calc(10rem * var(--card-scale)),
    calc(12vw  * var(--card-scale)),
    calc(18rem * var(--card-scale))
  );
  container-type: inline-size;
  border-radius: 14px;
  position: relative;
  --shadow-x: 0px;
  --shadow-y: 8px;
  --shadow-blur: 16px;
  --shadow-opacity: 0.35;
  --shadow-scale-x: 1;
}

.card-scaler::before {
  content: "";
  position: absolute;
  inset: 4%;
  border-radius: inherit;
  background: rgba(0, 0, 0, var(--shadow-opacity));
  filter: blur(var(--shadow-blur));
  transform: translate(var(--shadow-x), var(--shadow-y)) scaleX(var(--shadow-scale-x));
  z-index: -1;
  pointer-events: none;
  transition:
    filter    0.35s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    background 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

/* ── Showbill V4 layout ─────────────────────────────────────────── */

.card-spine {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 10cqi;
  background: #c32c4c;
  pointer-events: none;
}

.card-spine-label {
  position: absolute;
  left: 2cqi;
  top: 50%;
  transform: translateY(-50%) rotate(-90deg);
  transform-origin: center;
  font-family: 'Archivo Black', sans-serif;
  font-size: 2.6cqi;
  letter-spacing: .28em;
  color: #f6f3ea;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}

.card-body {
  position: absolute;
  left: 14cqi; right: 6cqi;
  top: 7cqi; bottom: 22cqi;
  display: flex;
  align-items: flex-start;
  overflow: hidden;
}

.card-body-text {
  font-family: 'Archivo Black', sans-serif;
  font-size: clamp(0.7rem, 9.5cqi, 2.2rem);
  line-height: 1.08;
  letter-spacing: -0.015em;
  text-transform: uppercase;
  color: #0d0f1a;
  margin: 0;
  overflow-wrap: break-word;
  word-break: break-word;
  hyphens: auto;
  width: 100%;
}

.card-watermark {
  position: absolute;
  right: -6cqi; bottom: -4cqi;
  width: 62cqi; height: auto;
  opacity: 0.09;
  pointer-events: none;
  user-select: none;
}

.card-footer {
  position: absolute;
  left: 14cqi; right: 6cqi; bottom: 5cqi;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  pointer-events: none;
}

.card-footer-pack {
  font-family: 'JetBrains Mono', monospace;
  font-size: 2.6cqi;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: rgba(13, 15, 26, .55);
}

.card-report-btn {
  position: absolute;
  bottom: 4cqi;
  left: 14cqi;
  font-size: 5.5cqi;
  opacity: 0.18;
  color: #0d0f1a;
  cursor: pointer;
  z-index: 10;
  line-height: 1;
  transition: opacity 0.3s ease;
}
.card-report-btn:hover { opacity: 0.5; }

/* Winner animation */
.card--winner {
  animation: winner-pulse 2s ease-in-out;
  box-shadow: 0 0 15px 5px rgba(34, 197, 94, 0.6);
}

@keyframes winner-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); outline: 0 solid rgba(34, 197, 94, 0); }
  50%  { box-shadow: 0 0 20px 10px rgba(34, 197, 94, 0.8); outline: 4px solid rgba(34, 197, 94, 0.8); }
  100% { box-shadow: 0 0 15px 5px rgba(34, 197, 94, 0.6); outline: 2px solid rgba(34, 197, 94, 0.6); }
}

/* ── Back face ──────────────────────────────────────────────────── */

.card-back-logo-wrap {
  position: absolute;
  left: 14cqi; right: 6cqi;
  top: 10cqi; bottom: 14cqi;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.card-back-logo-img {
  width: 100%; height: auto;
  max-height: 100%;
  object-fit: contain;
  object-position: left center;
}

.card-back-footer {
  position: absolute;
  left: 14cqi; right: 6cqi; bottom: 5cqi;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1.5px solid rgba(13, 15, 26, .25);
  padding-top: 2cqi;
  font-family: 'JetBrains Mono', monospace;
  font-size: 2.3cqi;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(13, 15, 26, .6);
}

.card-back-footer-mark {
  font-family: 'Archivo Black', sans-serif;
  letter-spacing: .2em;
  color: #0d0f1a;
}
</style>
