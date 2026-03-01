<template>
  <div
    class="card-scaler select-none perspective-[800px] justify-center flex items-center w-[clamp(6rem,12vw,18rem)] aspect-[3/4] hover:z-[100]"
  >
    <div
      ref="card"
      :class="{ 'card--flipped': flipped }"
      class="card cursor-pointer"
      @mouseleave="resetTransform"
      @mousemove="handleMouseMove"
      @click="$emit('click')"
    >
      <div class="card__inner cursor-pointer">
        <!-- Front Side -->
        <div class="card__face card__front cursor-pointer">
          <slot name="front">
            <div
              class="card-content rounded-lg relative overflow-hidden cursor-pointer"
            >
              <p
                class="card-text text-pretty cursor-pointer"
                v-html="formattedCardText"
              ></p>
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
                  <template #content class="">
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
            <span
              class="hidden md:flex items-center absolute bottom-0 right-0 m-2 p-1 text-lg bg-slate-900/50 rounded-lg text-slate-400"
            >
              <Icon class="align-middle" name="mdi:cards" />
              {{ computedNumPick }}
            </span>
          </slot>
        </div>

        <!-- Back Side -->
        <div class="card__face card__back cursor-pointer">
          <slot name="back">
            <div class="card-content cursor-pointer">
              <img
                :src="backLogoUrl"
                alt="Card Back Logo"
                class="w-3/4 max-w-[10rem] object-contain invert opacity-75 cursor-pointer"
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
import { computed, onMounted, ref, watch } from "vue";
import { debounce } from "lodash-es";
import ReportCard from "~/components/ReportCard.vue";
import { SFX } from "~/config/sfx.config";

// Define emits to fix the warning about extraneous non-emits event listeners
defineEmits(["click"]);

const { getRandomInRange } = useCrypto();
const { playSfx } = useSfx();
const { vibrate } = useVibrate({ pattern: [30, 20, 30], interval: 0 });
const { isMobile } = useDevice();

function playRandomFlip() {
  vibrate();
  playSfx(SFX.cardFlip, { volume: 0.75, pitch: [0.95, 1.05] });
}

const props = defineProps<{
  cardId?: string;
  text?: string;
  cardPack?: string;
  numPick?: number;
  flipped?: boolean;
  threeDeffect?: boolean;
  shine?: boolean;
  backLogoUrl?: string;
  maskUrl?: string;
}>();

const fallbackNumPick = ref<number | undefined>(undefined);

const computedNumPick = computed(() => {
  // 1. Prioritize the explicitly passed prop
  if (props.numPick !== undefined) {
    return props.numPick;
  }
  // 2. Use the value fetched via cardId if the prop wasn't passed
  if (fallbackNumPick.value !== undefined) {
    return fallbackNumPick.value;
  }
  // 3. Default to 1 if neither prop nor fetched value is available
  return 1;
  // Note: The underscore counting logic is removed as we prioritize the database value.
});

const fallbackText = ref("");

const cardText = computed(() => props.text || fallbackText.value);

const formattedCardText = computed(() => {
  return cardText.value.replace(
    /_/g,
    '<span class="inline-block relative w-1/2 align-middle bg-slate-600/50 rounded-sm outline-dashed outline-1 outline-white/25 inset-shadow-xs inset-shadow-black/50 border-b-1 border-white/25 mx-1" style="height: 1em; padding-block: 0.1em;"></span>',
  );
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
    background: `
      linear-gradient(
        ${angle}deg,
        transparent,
        red,
        transparent,
        orange,
        transparent,
        yellow,
        transparent,
        green,
        transparent,
        cyan,
        transparent,
        blue,
        transparent,
        violet,
        transparent,
        red
      )
    `,
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
    opacity: 0.125,
    transition: "background-position 250ms linear, background 250ms linear",
  };
});

function handleMouseMove(e: MouseEvent) {
  if (!card.value) return;
  if (isMobile) return;

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
  card.value.style.transform = `
    rotateX(${rotateX * intensity}deg)
    rotateY(${rotateY * intensity}deg)
  `;

  // Physical shadow tracks the tilt
  updateShadow(rotateX, rotateY, intensity);
}

function resetTransform() {
  if (card.value) {
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
    // Quick dip: card narrows and tilts forward as it bends mid-flip
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
  // Fetch card data only if text AND numPick are not provided, but cardId is.
  if ((!props.text || props.numPick === undefined) && props.cardId) {
    const { databases, tables } = getAppwrite();
    const config = useRuntimeConfig();
    if (!databases) {
      console.error("Appwrite database service not available.");
      return;
    }
    try {
      // `Fetching full card data for ID: ${props.cardId}`);
      const doc = await tables.getRow({
        databaseId: config.public.appwriteDatabaseId,
        tableId: config.public.appwriteBlackCardCollectionId,
        rowId: props.cardId,
      });
      if (!props.text) {
        fallbackText.value = (doc as any).text;
      }
      if (!props.cardId) {
        fallbackText.value = "CARD TEXT HERE";
        return;
      }
      if (props.numPick === undefined) {
        fallbackNumPick.value = (doc as any).pick; // Store the fetched pick value
      }
      cardPack.value = (doc as any).pack || null;
    } catch (error) {
      console.error(`Failed to fetch card data for ID ${props.cardId}:`, error);
      // Set sensible defaults on error if needed
      if (!props.text) fallbackText.value = "Error loading text.";
      if (props.numPick === undefined) fallbackNumPick.value = 1;
    }
  }

  resetTransform();
  animateShine();
});
</script>

<style scoped>
.card {
  width: 100%;
  height: 100%;
  /* No background here — .card__inner provides the Firefox GPU seam-gap
     colour AND rotates with the flip animation. A background on this
     static wrapper would appear as a non-rotating layer mid-flip. */
  border-radius: 12px;
  transform-style: preserve-3d;
  position: relative;
  transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  /* Hint the compositor to use a single layer for the 3D element tree,
     reducing tile-boundary calculations in Firefox/Gecko */
  will-change: transform;
}

.card--flipped {
  transform: rotateY(180deg);
}

.card__inner {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  /* Match the card-face colour so any GPU tile-seam gaps in the children
     reveal this same colour instead of transparent → dark. */
  background-color: #1c2342;
  border-radius: 12px;
}

.card__face {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.25rem;
  text-align: center;
  border-radius: 12px;
  /* Ensure content is positioned correctly */
  z-index: 1;
  /* Firefox anti-aliasing fix: transparent outline forces the compositor to
     rasterize rounded corners with AA during preserve-3d transforms */
  outline: 1px solid transparent;
  /* Firefox GPU tiling fix: opacity < 1 forces a new stacking context with
     different GPU compositing, bypassing the tiled rendering path.
     NOTE: filter:blur(0) is on .card-content instead — applying it here
     can break backface-visibility in Gecko's 3D pipeline. */
  opacity: 0.999;
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
  background-color: #1c2342;
}

.card__back {
  background-color: #1c2342;
}

/* Ensure shine effect is properly positioned on both sides */
.card__front .card__shine,
.card__back .card__shine {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  opacity: 0.25;
}

.card__back {
  transform: rotateY(180deg);
}

.card__shine {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 100; /* Higher z-index to ensure it's on top */
  border-radius: 12px;
}

.card-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  /* Ensure content is above the texture */
  z-index: 1;
  color: white;
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
  border: 6px solid rgba(42, 52, 99, 0.35);
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
}
</style>
