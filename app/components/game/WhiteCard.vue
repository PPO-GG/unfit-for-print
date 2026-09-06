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
        {
          'card--flipped': flipped,
          'card--winner': isWinner,
          'card--thick': showEdge,
        },
      ]"
      class="card cursor-pointer"
      @mouseleave="resetTransform"
      @mousemove="handleMouseMove"
      @click="$emit('click')"
    >
      <div
        class="card__inner cursor-pointer"
        :class="flat ? 'card__inner--flat' : 'card__inner--3d'"
        :style="showEdge ? { '--card-thickness': `${thickness}cqi` } : undefined"
      >
        <!-- Extruded edge. Slices rather than four side quads because every
             slice carries the card's own 14px radius, so the rounded corners
             come out solid instead of notched. -->
        <div v-if="showEdge" class="card__edge" aria-hidden="true">
          <span
            v-for="(z, i) in edgeOffsets"
            :key="i"
            class="card__edge-slice"
            :style="{ '--edge-z': z }"
          />
        </div>
        <!-- Front Side (3D mode: always rendered, hidden by backface-visibility;
             Flat mode: only rendered when not flipped) -->
        <div
          v-if="!flat || !flipped"
          class="card__face card__front cursor-pointer"
        >
          <slot name="front">
            <div class="card-content cursor-pointer">
              <div class="card-spine" />
              <span class="card-spine-label" aria-hidden="true"
                >UNFIT · FOR · PRINT</span
              >
              <img
                v-if="resolvedImageUrl"
                class="card-image"
                :src="resolvedImageUrl"
                :style="imageStyle"
                alt=""
                draggable="false"
              />
              <div v-else ref="cardBodyEl" class="card-body">
                <p
                  ref="cardTextEl"
                  lang="en"
                  class="card-body-text text-pretty cursor-pointer"
                >
                  {{ displayText }}
                </p>
              </div>
              <img
                class="card-watermark"
                src="/img/unfit_logo_alt_dark.png"
                alt=""
                aria-hidden="true"
                draggable="false"
              />
              <div class="card-footer">
                <span class="card-footer-pack">{{ cardPack || "" }}</span>
              </div>
              <div class="card-report-btn" @click.stop>
                <UPopover
                  v-model:open="showReportPopover"
                  :ui="{
                    content:
                      'w-full backdrop-blur-sm bg-slate-900/50 rounded-lg',
                  }"
                  arrow
                >
                  <Icon name="lucide:circle-help" class="flex cursor-pointer" />
                  <template #content>
                    <div class="flex-1 p-4">
                      <p class="text-sm p-1 font-mono break-all">
                        <span class="text-yellow-500 font-sans">Card ID: </span
                        >{{ cardId ?? "" }}
                      </p>
                      <p class="text-sm p-1 font-mono break-all">
                        <span class="text-yellow-500 font-sans"
                          >Card Pack: </span
                        >{{ cardPack }}
                      </p>
                      <UButton
                        class="mt-2"
                        color="warning"
                        label="Report This Card"
                        variant="subtle"
                        @click.stop="
                          showReportPopover = false;
                          showReportModal = true;
                        "
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
              <span class="card-spine-label" aria-hidden="true"
                >UNFIT · FOR · PRINT</span
              >
              <div class="card-back-logo-wrap">
                <img
                  class="card-back-logo-img"
                  src="/img/unfit_logo_alt_dark.png"
                  alt="Unfit For Print"
                  draggable="false"
                />
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
// Imported rather than auto-imported so the component can be mounted outside a
// Nuxt context, as tests/components/game/WhiteCard.test.ts does.
import { useCardShine } from "~/composables/useCardShine";
import { SFX } from "~/config/sfx.config";
import type { CardAttachmentConfig } from "~/types/card";
import { DEFAULT_CARD_ATTACHMENT } from "~/utils/cardAttachmentDefaults";
import { getCardImageUrl } from "~/utils/cardImage";

// Define emits to fix the warning about extraneous non-emits event listeners
defineEmits(["click"]);

const { getRandomInRange } = useCrypto();
const { playSfx } = useSfx();
const { vibrate } = useVibrate({
  pattern: [30, 20, 30],
  interval: 0,
});
const { isMobile, isFirefox } = useDevice();

function playRandomFlip() {
  vibrate();
  playSfx(SFX.cardFlip, { volume: 0.75, pitch: [0.95, 1.05] });
}

const props = withDefaults(
  defineProps<{
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
    /** Peak hover tilt in degrees at the card's corners. The default is the
     *  restrained in-game amount; display cards push it further, because a
     *  steeper angle is what actually shows off `thickness`. */
    tiltDegrees?: number;
    /** Edge depth as a percentage of the card's own width (cqi), so it tracks
     *  whatever size the card is rendered at. 0 = the old zero-thickness sheet.
     *  Ignored in `flat` mode, which has no 3D space to extrude into. */
    thickness?: number;
    /** Size scale as a percentage. 100 = default size, 50 = half size, etc. */
    scale?: number;
    /** Picture-card image URL. When set, renders full-bleed instead of text. */
    imageUrl?: string;
    attachment?: CardAttachmentConfig | null;
  }>(),
  {
    scale: 100,
    thickness: 0,
    tiltDegrees: 15,
  },
);

// Six slices is enough that the seam between them stays sub-pixel at the ±15°
// the hover tilt reaches; it opens up past ~50°, which only a flip gets to.
const EDGE_SLICES = 6;
// Fractions of the thickness, front (+0.5) to back (-0.5), kept strictly
// between the two faces so no slice is coplanar with one and z-fights it.
const edgeOffsets = Array.from(
  { length: EDGE_SLICES },
  (_, i) => 0.5 - (i + 1) / (EDGE_SLICES + 1),
);
// Firefox opts out: the extrusion adds EDGE_SLICES more preserve-3d layers per
// card, which is exactly what feeds the GPU tiling artifacts the `flat` prop
// exists to dodge. It falls back to the flat-sheet 3D card, not to `flat` mode,
// so the flip and the tilt are untouched. Chromium (Brave included) and WebKit
// get the thickness.
const showEdge = computed(
  () => !props.flat && !isFirefox && props.thickness > 0,
);

const fallbackText = ref("");
const fallbackImageUrl = ref<string | null>(null);
const fallbackAttachment = ref<CardAttachmentConfig | null>(null);
const cardText = computed(() => props.text || fallbackText.value);
const normalDisplayText = computed(() =>
  hyphenateCardText(glueOrphanPunctuation(cardText.value)),
);
const hasEmergencyBreaks = ref(false);
const displayText = computed(() =>
  hasEmergencyBreaks.value
    ? emergencyHyphenateCardText(normalDisplayText.value)
    : normalDisplayText.value,
);
watch(normalDisplayText, () => {
  hasEmergencyBreaks.value = false;
});
const resolvedImageUrl = computed(
  () => props.imageUrl || fallbackImageUrl.value || null,
);
const resolvedAttachment = computed(
  () => props.attachment ?? fallbackAttachment.value ?? DEFAULT_CARD_ATTACHMENT,
);
const imageStyle = computed(() => ({
  transform: `translate(${resolvedAttachment.value.offsetX * 100}%, ${resolvedAttachment.value.offsetY * 100}%) scale(${resolvedAttachment.value.scale})`,
}));
const cardBodyEl = ref<HTMLElement | null>(null);
const cardTextEl = ref<HTMLElement | null>(null);
// The lightbox renders the card supersampled (see --card-ss in the styles
// below), which multiplies every cqi-derived length but leaves useFitText's
// absolute rem ceiling where it was — so hand it the same factor.
function readCardSupersample() {
  const el = cardBodyEl.value;
  if (!el) return 1;
  return parseFloat(getComputedStyle(el).getPropertyValue("--card-ss"));
}
useFitText(cardBodyEl, cardTextEl, displayText, {
  remScale: readCardSupersample,
  onEmergencyBreaks: () => {
    if (hasEmergencyBreaks.value) return false;
    hasEmergencyBreaks.value = true;
    return true;
  },
});
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
// Owns its own frame loop and cancels it on unmount — see useCardShine.
const { shineOffset } = useCardShine(rotation, () => !props.disableHover);
const showReportPopover = ref(false);
const showReportModal = ref(false);

watch(showReportModal, (isOpen) => {
  if (isOpen) {
    showReportPopover.value = false;
  }
});

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

  const rotateX = Math.round(((y - centerY) / centerY) * props.tiltDegrees);
  const rotateY = Math.round(((centerX - x) / centerX) * props.tiltDegrees);

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
  if (!props.text && !props.imageUrl) {
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
        const [doc] = await $fetch<
          {
            id: string;
            text: string | null;
            pack: string;
            imageKey: string | null;
            imageFormat: string | null;
            attachment: CardAttachmentConfig | null;
          }[]
        >("/api/cards/resolve", {
          method: "POST",
          body: { ids: [props.cardId] },
        });

        if (doc && doc.imageKey) {
          fallbackImageUrl.value = getCardImageUrl(doc.imageKey);
          fallbackAttachment.value = doc.attachment;
          cardPack.value = doc.pack || null;
        } else if (doc && doc.text) {
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
  }
});
</script>

<style scoped>
/* ── Shared base styles (both 3D and flat modes) ────────────────── */
.card {
  width: 100%;
  height: 100%;
  border-radius: var(--card-radius);
  position: relative;
  transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.card--flipped:not(.card--flat) {
  transform: rotateY(180deg);
}

.card__inner {
  --card-thickness: 0px;
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
  font-size: calc(1.25rem * var(--card-ss));
  text-align: center;
  border-radius: var(--card-radius);
  z-index: 1;
}

.card__front,
.card__back {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  border-radius: var(--card-radius);
}

.card__front {
  background-color: #f6f3ea;
}
.card__back {
  background-color: #f6f3ea;
}

.card__front .card__shine,
.card__back .card__shine {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: var(--card-radius);
}

.card__shine {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 100;
  transition: background-position 250ms linear;
  border-radius: var(--card-radius);
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
  border-radius: var(--card-radius);
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

/* ── Thickness ──────────────────────────────────────────────────────
   Opt-in: the face transforms and the extra preserve-3d layers only exist when
   a caller asks for thickness, so nothing changes for the cards that don't —
   and Firefox gets no additional 3D layers to tile-artifact on. */
.card--3d.card--thick .card__front {
  transform: translateZ(calc(var(--card-thickness) / 2));
}

.card--3d.card--thick .card__back {
  transform: rotateY(180deg) translateZ(calc(var(--card-thickness) / 2));
}

.card__edge {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  pointer-events: none;
}

/* Each slice is a full rounded rect stacked between the two faces. Only the
   sliver the front face's parallax fails to cover is visible, and the stack of
   those slivers reads as the rim. The vertical gradient is the same overhead
   light .card-content::before simulates on the face. */
.card__edge-slice {
  position: absolute;
  inset: 0;
  border-radius: var(--card-radius);
  background: linear-gradient(180deg, #efe9dc 0%, #ddd6c4 45%, #b3ab99 100%);
  transform: translateZ(calc(var(--edge-z) * var(--card-thickness)));
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
  border-radius: var(--card-radius);
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
  border-radius: var(--card-radius);
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
  border-radius: var(--card-radius);
  transition: opacity 0.15s ease-out;
}

.card-scaler {
  --card-scale: 1;
  /* Supersampling knob. Chromium rasterizes a promoted 3D layer once and then
     transforms the texture, so a tilted card's edges get no antialiasing; the
     fix is to render it larger and scale it back down, letting the downsample
     do the antialiasing. Everything sized in cqi follows the container for
     free, so a caller that widens this box by N and scales it back down only
     has to correct the absolute lengths -- which is all this multiplier does.
     1 = off, which is every caller but the Labs lightbox. */
  --card-ss: 1;
  --card-radius: calc(14px * var(--card-ss));
  width: clamp(
    calc(10rem * var(--card-scale)),
    calc(12vw * var(--card-scale)),
    calc(18rem * var(--card-scale))
  );
  container-type: inline-size;
  border-radius: var(--card-radius);
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
  filter: blur(calc(var(--shadow-blur) * var(--card-ss)));
  transform: translate(
      calc(var(--shadow-x) * var(--card-ss)),
      calc(var(--shadow-y) * var(--card-ss))
    )
    scaleX(var(--shadow-scale-x));
  z-index: -1;
  pointer-events: none;
  transition:
    filter 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    background 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

/* ── Showbill V4 layout ─────────────────────────────────────────── */

.card-spine {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5cqi;
  background: #c32c4c;
  pointer-events: none;
  z-index: 2;
}

.card-spine-label {
  position: absolute;
  left: 2.5cqi;
  top: 50%;
  transform: translate(-50%, -50%) rotate(-90deg);
  transform-origin: center;
  font-family: "Archivo Black", sans-serif;
  font-size: 2.6cqi;
  letter-spacing: 0.28em;
  color: #f6f3ea;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
  z-index: 3;
}

.card-body {
  position: absolute;
  left: 9cqi;
  right: 9cqi;
  top: 7cqi;
  bottom: 22cqi;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.card-body-text {
  font-family: "Archivo Black", sans-serif;
  font-size: clamp(
    calc(0.7rem * var(--card-ss)),
    9.5cqi,
    calc(2.2rem * var(--card-ss))
  );
  line-height: 1.08;
  letter-spacing: -0.015em;
  text-align: left;
  text-transform: uppercase;
  color: #0d0f1a;
  margin: 0;
  overflow-wrap: break-word;
  -webkit-hyphens: auto;
  hyphens: auto;
  width: 100%;
}

.card-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--card-radius);
  pointer-events: none;
  user-select: none;
}

.card-watermark {
  position: absolute;
  right: 0cqi;
  bottom: -4cqi;
  width: 62cqi;
  height: auto;
  opacity: 0.07;
  pointer-events: none;
  user-select: none;
}

.card-footer {
  position: absolute;
  left: 9cqi;
  right: 6cqi;
  bottom: 5cqi;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  pointer-events: none;
}

.card-footer-pack {
  font-family: "JetBrains Mono", monospace;
  font-size: 2.6cqi;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(13, 15, 26, 0.55);
}

.card-report-btn {
  position: absolute;
  top: 1.2cqi;
  left: 7cqi;
  font-size: 5.5cqi;
  opacity: 0.18;
  color: #0d0f1a;
  cursor: pointer;
  z-index: 10;
  line-height: 1;
  transition: opacity 0.3s ease;
}
.card-report-btn:hover {
  opacity: 0.5;
}

/* Winner animation */
.card--winner {
  animation: winner-pulse 2s ease-in-out;
  box-shadow: 0 0 calc(15px * var(--card-ss))
    calc(5px * var(--card-ss)) rgba(34, 197, 94, 0.6);
}

@keyframes winner-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
    outline: 0 solid rgba(34, 197, 94, 0);
  }
  50% {
    box-shadow: 0 0 calc(20px * var(--card-ss))
      calc(10px * var(--card-ss)) rgba(34, 197, 94, 0.8);
    outline: calc(4px * var(--card-ss)) solid rgba(34, 197, 94, 0.8);
  }
  100% {
    box-shadow: 0 0 calc(15px * var(--card-ss))
      calc(5px * var(--card-ss)) rgba(34, 197, 94, 0.6);
    outline: calc(2px * var(--card-ss)) solid rgba(34, 197, 94, 0.6);
  }
}

/* ── Back face ──────────────────────────────────────────────────── */

.card-back-logo-wrap {
  position: absolute;
  left: 9cqi;
  right: 6cqi;
  top: 10cqi;
  bottom: 14cqi;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.card-back-logo-img {
  width: 100%;
  height: auto;
  max-height: 100%;
  object-fit: contain;
  object-position: left center;
}

.card-back-footer {
  position: absolute;
  left: 9cqi;
  right: 6cqi;
  bottom: 5cqi;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: calc(1.5px * var(--card-ss)) solid rgba(13, 15, 26, 0.25);
  padding-top: 2cqi;
  font-family: "JetBrains Mono", monospace;
  font-size: 2.3cqi;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(13, 15, 26, 0.6);
}

.card-back-footer-mark {
  font-family: "Archivo Black", sans-serif;
  letter-spacing: 0.2em;
  color: #0d0f1a;
}
</style>
