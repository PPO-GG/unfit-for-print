<template>
  <div
    class="card-scaler select-none perspective-[800px] justify-center flex items-center aspect-[3/4] hover:z-[100]"
    :style="{ '--card-scale': scale / 100 }"
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
            <div class="card-content cursor-pointer">
              <div class="card-spine" />
              <span class="card-spine-label" aria-hidden="true">UNFIT · FOR · PRINT</span>
              <div class="card-body">
                <p class="card-body-text cursor-pointer" v-html="formattedCardText" />
              </div>
              <img
                class="card-watermark"
                src="/img/unfit_logo_alt.png"
                alt=""
                aria-hidden="true"
                draggable="false"
              />
              <div class="card-footer">
                <span class="card-footer-pack">{{ cardPack || '' }}</span>
                <span v-if="computedNumPick" class="card-footer-pick">PICK {{ computedNumPick }}</span>
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

        <!-- Back Side -->
        <div class="card__face card__back cursor-pointer">
          <slot name="back">
            <div class="card-content cursor-pointer">
              <div class="card-spine" />
              <span class="card-spine-label" aria-hidden="true">UNFIT · FOR · PRINT</span>
              <div class="card-back-logo-wrap">
                <img
                  class="card-back-logo-img"
                  src="/img/unfit_logo_alt.png"
                  alt="Unfit For Print"
                  draggable="false"
                />
              </div>
              <div class="card-back-footer">
                <span>ED. 001 · PROMPTS</span>
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

const props = withDefaults(defineProps<{
  cardId?: string;
  text?: string;
  cardPack?: string;
  numPick?: number;
  flipped?: boolean;
  threeDeffect?: boolean;
  shine?: boolean;
  backLogoUrl?: string;
  maskUrl?: string;
  /** Size scale as a percentage. 100 = default size, 50 = half size, etc. */
  scale?: number;
}>(), {
  scale: 100,
});

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
    '<span style="display:inline-block;width:38%;height:0.75em;vertical-align:-2px;border-bottom:2px solid rgba(255,255,255,.75);margin:0 4px;"></span>',
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

  // Simulate overhead lighting: tilting toward the light (negative rotateX) brightens,
  // tilting away darkens. Subtle range ~0.88–1.12.
  const brightness = 1 + rotateX * intensity * 0.02;
  card.value.style.setProperty("--card-brightness", brightness.toFixed(3));

  // Physical shadow tracks the tilt
  updateShadow(rotateX, rotateY, intensity);
}

function resetTransform() {
  if (card.value) {
    rotation.value = { x: 0, y: 0 };
    applyTransform(0, 0);
    card.value.style.removeProperty("--card-brightness");
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
    try {
      const [doc] = await $fetch<
        { id: string; text: string; pack: string; pick?: number }[]
      >("/api/cards/resolve", {
        method: "POST",
        body: { ids: [props.cardId], type: "black" },
      });
      if (!doc) {
        throw new Error(`Card not found for ID ${props.cardId}`);
      }
      if (!props.text) {
        fallbackText.value = doc.text;
      }
      if (!props.cardId) {
        fallbackText.value = "CARD TEXT HERE";
        return;
      }
      if (props.numPick === undefined) {
        fallbackNumPick.value = doc.pick;
      }
      cardPack.value = doc.pack || null;
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
  border-radius: 14px;
  transform-style: preserve-3d;
  position: relative;
  transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
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
  background-color: #0d0f1a;
  border-radius: 14px;
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
  border-radius: 14px;
  z-index: 1;
  outline: 1px solid transparent;
  opacity: 0.999;
}

.card__front,
.card__back {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  border-radius: 14px;
}

.card__front { background-color: #0d0f1a; }
.card__back  { background-color: #0d0f1a; }

.card__front .card__shine,
.card__back  .card__shine {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  border-radius: 14px;
  opacity: 0.25;
}

.card__back {
  transform: rotateY(180deg);
}

.card__shine {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 100;
  border-radius: 14px;
}

.card-content {
  position: relative;
  width: 100%;
  height: 100%;
  z-index: 1;
  color: #f6f3ea;
  border-radius: 14px;
  overflow: hidden;
  filter: blur(0) brightness(var(--card-brightness, 1));
  transition: filter 0.15s ease-out;
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
  background: #f5d442;
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
  color: #0d0f1a;
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
  color: #f6f3ea;
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
  opacity: 0.07;
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
  color: rgba(255, 255, 255, .55);
}

.card-footer-pick {
  font-family: 'Archivo Black', sans-serif;
  font-size: 4.2cqi;
  letter-spacing: .04em;
  line-height: 1;
  color: #f6f3ea;
}

.card-report-btn {
  position: absolute;
  bottom: 4cqi;
  left: 14cqi;
  font-size: 5.5cqi;
  opacity: 0.18;
  color: #f6f3ea;
  cursor: pointer;
  z-index: 10;
  line-height: 1;
  transition: opacity 0.3s ease;
}
.card-report-btn:hover { opacity: 0.5; }

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
  border-top: 1.5px solid rgba(255, 255, 255, .25);
  padding-top: 2cqi;
  font-family: 'JetBrains Mono', monospace;
  font-size: 2.3cqi;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, .6);
}

.card-back-footer-mark {
  font-family: 'Archivo Black', sans-serif;
  letter-spacing: .2em;
  color: #f6f3ea;
}
</style>
