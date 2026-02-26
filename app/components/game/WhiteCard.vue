<template>
  <div
    v-bind="$attrs"
    class="card-scaler select-none justify-center flex items-center w-[clamp(6rem,12vw,18rem)] aspect-[3/4] hover:z-[100]"
    :class="flat ? '' : 'perspective-[800px]'"
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
            <div
              class="card-content rounded-lg relative overflow-hidden cursor-pointer"
            >
              <p class="card-text text-pretty cursor-pointer">
                {{ cardText }}
              </p>
              <div
                class="absolute bottom-0 left-0 m-3 text-xl opacity-10 hover:opacity-50 transition-opacity duration-500"
              >
                <UPopover
                  :ui="{
                    content:
                      'w-full backdrop-blur-sm bg-slate-900/50 rounded-lg',
                  }"
                  arrow
                >
                  <span class="flex" @click.stop>
                    <Icon class="z-10 cursor-pointer" name="mdi:cards" />
                  </span>
                  <template #content>
                    <div class="flex-1 p-4">
                      <p class="text-md p-1">
                        <span class="text-yellow-500">Card ID: </span
                        >{{ cardId ?? "" }}
                      </p>
                      <p class="text-md p-1">
                        <span class="text-yellow-500">Card Pack: </span
                        >{{ cardPack }}
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
              <img
                :src="backLogoUrl"
                alt="Card Back Logo"
                class="w-3/4 max-w-[10rem] object-contain opacity-75 cursor-pointer"
                draggable="false"
              />
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
        card-type="black"
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

const props = defineProps<{
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
}>();

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

  // Physical shadow tracks the tilt
  updateShadow(rotateX, rotateY, intensity);
}

function resetTransform() {
  if (card.value && !props.disableHover) {
    rotation.value = { x: 0, y: 0 };
    applyTransform(0, 0);
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
      const { databases, tables } = getAppwrite();
      if (!databases || !tables) {
        console.warn(
          "Appwrite databases or tables not available for card:",
          props.cardId,
        );
        fallbackText.value = "This card will be revealed soon";
        return;
      }

      const config = useRuntimeConfig();
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
        const doc = await tables.getRow({
          databaseId: config.public.appwriteDatabaseId,
          tableId: config.public.appwriteWhiteCardCollectionId,
          rowId: props.cardId,
        });

        if (doc && (doc as any).text) {
          fallbackText.value = (doc as any).text;
          cardPack.value = (doc as any).pack || null;
        } else {
          console.warn(
            "Card document found but text is missing for ID:",
            props.cardId,
          );
          fallbackText.value = "Card text unavailable";
        }
      } catch (docError: any) {
        console.error("Error fetching card text:", docError);

        const errorMessage =
          typeof docError === "string" ? docError : docError?.message || "";

        // Provide a more specific error message for document not found
        if (
          errorMessage.includes(
            "Document with the requested ID could not be found",
          )
        ) {
          fallbackText.value = "This card is from another game";
        } else if (
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
/* ── Shared base styles (both 3D and flat modes) ───────────────── */
.card {
  width: 100%;
  height: 100%;
  border-radius: 12px;
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
  border-radius: 12px;
  z-index: 1;
}

.card__front,
.card__back {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  border-radius: 12px;
}

.card__front {
  background-color: #e7e1de;
}

.card__back {
  background-color: #e7e1de;
}

.card__front .card__shine,
.card__back .card__shine {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 12px;
}

.card__shine {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 100;
  transition: background-position 250ms linear;
  border-radius: 12px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   3D MODE — interactive cards that need animated flip (homepage, judging grid)
   Uses preserve-3d + backface-visibility for real 3D card flip.
   ═══════════════════════════════════════════════════════════════════════════ */
.card--3d {
  /* No background here — .card__inner--3d provides the Firefox GPU seam-gap
     colour AND rotates with the flip animation. A background on this
     static wrapper would appear as a non-rotating layer mid-flip. */
  transform-style: preserve-3d;
  will-change: transform;
}

.card--3d .card__inner--3d {
  transform-style: preserve-3d;
  background-color: #e7e1de;
  border-radius: 12px;
}

.card--3d .card__face {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  /* Firefox anti-aliasing fix: transparent outline forces the compositor to
     rasterize rounded corners with AA during preserve-3d transforms */
  outline: 1px solid transparent;
  /* Firefox GPU tiling fix: opacity < 1 forces a new stacking context with
     different GPU compositing, bypassing the tiled rendering path. */
  opacity: 0.999;
}

/* Extend the AA fix to the front/back panels — they have their own
   border-radius and get rasterized as separate 3D layers in Gecko. */
.card--3d .card__front,
.card--3d .card__back {
  outline: 1px solid transparent;
}

.card--3d .card__back {
  transform: rotateY(180deg);
}

/* ═══════════════════════════════════════════════════════════════════════════
   FLAT MODE — static cards (hand, pile) where flip is not animated.
   No preserve-3d = no Firefox GPU tiling = no seam artifacts.
   Front/back visibility is controlled by v-if in the template.
   ═══════════════════════════════════════════════════════════════════════════ */
.card--flat {
  background: #e7e1de;
  transform-style: flat;
}

.card--flat .card__inner--flat {
  transform-style: flat;
  border-radius: 12px;
}

/* In flat mode, the visible face is rendered normally (no 3D rotation).
   The back face doesn't need rotateY(180deg) because v-if handles visibility. */
.card--flat .card__back {
  transform: none;
}

.card-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1;
  color: black;
  border-radius: 12px;
  /* overflow:hidden moved here from .card__face to avoid Firefox 3D compositing seam artifacts */
  overflow: hidden;
  /* Firefox GPU tiling fix: filter forces a temporary compositing surface that
     flattens the content into a single raster layer BEFORE the parent's 3D
     transform is applied. Placed here (inside the face) rather than on
     .card__face to avoid interfering with backface-visibility. */
  filter: blur(0);
}

/* Decorative border + vignette — on .card-content (clipped by overflow:hidden) instead of .card__face (in the 3D chain) to avoid Firefox rectangular bounding box artifacts */
.card-content::after {
  content: "";
  position: absolute;
  inset: 0;
  border: 6px solid rgba(0, 0, 0, 0.25);
  pointer-events: none;
  z-index: 10;
  border-radius: 12px;
  box-shadow: inset 0 0 100px 0 rgba(0, 0, 0, 0.25);
}

.card-scaler {
  container-type: inline-size;
  border-radius: 12px;
  position: relative;
  /* Default shadow values; JS overrides during hover / flip */
  --shadow-x: 0px;
  --shadow-y: 8px;
  --shadow-blur: 16px;
  --shadow-opacity: 0.35;
  --shadow-scale-x: 1;
}

/* Shadow blob — a blurred dark pseudo that acts as a physical ground shadow.
   Unlike box-shadow (which only radiates outward and leaves a cutout),
   this is a real filled element visible even directly under the card. */
.card-scaler::before {
  content: "";
  position: absolute;
  inset: 4%;
  border-radius: inherit;
  background: rgba(0, 0, 0, var(--shadow-opacity));
  filter: blur(var(--shadow-blur));
  transform: translate(var(--shadow-x), var(--shadow-y))
    scaleX(var(--shadow-scale-x));
  z-index: -1;
  pointer-events: none;
  transition:
    filter 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    background 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.card-text {
  font-size: clamp(0.55rem, 12.8cqi, 2.3rem);
  line-height: 1.2;
  padding: 6.4cqi;
  color: black;
}

/* Winner animation styles */
.card--winner {
  animation: winner-pulse 2s ease-in-out;
  box-shadow: 0 0 15px 5px rgba(34, 197, 94, 0.6);
}

@keyframes winner-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
    outline: 0 solid rgba(34, 197, 94, 0);
  }
  50% {
    box-shadow: 0 0 20px 10px rgba(34, 197, 94, 0.8);
    outline: 4px solid rgba(34, 197, 94, 0.8);
  }
  100% {
    box-shadow: 0 0 15px 5px rgba(34, 197, 94, 0.6);
    outline: 2px solid rgba(34, 197, 94, 0.6);
  }
}
</style>
