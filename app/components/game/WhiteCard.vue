<template>
  <div
    class="select-none perspective-distant justify-center flex items-center w-40 md:w-56 lg:w-60 xl:w-68 2xl:w-72 aspect-[3/4] hover:z-[100]"
  >
    <div
      ref="card"
      :class="{ 'card--flipped': flipped, 'card--winner': isWinner }"
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
                :style="textStyle"
                class="leading-6 md:leading-none p-3 md:p-4 text-pretty cursor-pointer"
              >
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
                    <div class="flex-1 p-4 font-[Bebas_Neue]">
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

        <!-- Back Side -->
        <div class="card__face card__back cursor-pointer">
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
    :overlay="false"
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
import ReportCard from "~/components/ReportCard.vue";

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
  playSfx(
    ["/sounds/sfx/flip1.wav", "/sounds/sfx/flip2.wav", "/sounds/sfx/flip3.wav"],
    { volume: 0.75, pitch: [0.95, 1.05] },
  );
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
const textSize = ref(1);
const rotation = ref({ x: 0, y: 0 });
const shineOffset = ref({ x: 0, y: 0 });
const showReportModal = ref(false);

const textStyle = computed(() => {
  return {
    fontSize: `${textSize.value}rem`,
    lineHeight: `${Math.max(1, textSize.value * 1.1)}rem`,
    padding: `${textSize.value * 0.5}rem`,
  };
});

function calculateTextSize() {
  if (!card.value) return;

  const width = card.value.offsetWidth;
  textSize.value = Math.max(0.2, width / 125);
}

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

  const rotateX = ((y - centerY) / centerY) * 15;
  const rotateY = ((centerX - x) / centerX) * 15;

  rotation.value = { x: rotateX, y: rotateY };

  applyTransform(rotateX, rotateY);
}

function applyTransform(rotateX = 0, rotateY = 0) {
  if (!card.value) return;
  const intensity = props.threeDeffect ? 1 : 0.3;

  // Only tilt the outer .card container
  card.value.style.transform = `rotateX(${rotateX * intensity}deg) rotateY(${rotateY * intensity}deg)`;
}

function resetTransform() {
  if (card.value && !props.disableHover) {
    rotation.value = { x: 0, y: 0 };
    applyTransform(0, 0);
  }
}

watch(
  () => props.flipped,
  (flipped) => {
    const el = card.value?.querySelector(".card__inner");
    if (!el) return;

    gsap.to(el, {
      rotateY: flipped ? 180 : 0,
      duration: 1.5,
      ease: "elastic.out(0.2,0.1)",
      onStart: () => playRandomFlip(),
    });
  },
);

watch(
  () => card.value?.offsetWidth,
  () => {
    calculateTextSize();
  },
);

onMounted(async () => {
  if (!props.text) {
    try {
      const { databases } = useAppwrite();
      if (!databases) {
        console.warn(
          "Appwrite databases not available for card:",
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
        const doc = await databases.getDocument(
          config.public.appwriteDatabaseId,
          config.public.appwriteWhiteCardCollectionId,
          props.cardId,
        );

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
      } catch (docError: string | any) {
        console.error("Error fetching card text:", docError);
// "Card ID:", props.cardId);

        // Provide a more specific error message for document not found
        if (
          docError.includes("Document with the requested ID could not be found")
        ) {
          fallbackText.value = "This card is from another game";
        } else if (docError.includes("Network error")) {
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

  calculateTextSize();
  window.addEventListener("resize", calculateTextSize);

  if (!props.disableHover) {
    resetTransform();
    animateShine();
  }

  onBeforeUnmount(() => {
    window.removeEventListener("resize", calculateTextSize);
  });
});
</script>

<style scoped>
.card {
  width: 100%;
  height: 100%;
  background: transparent;
  border-radius: 12px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  transform-style: preserve-3d;
  position: relative;
  transition:
    transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275),
    box-shadow 0.3s ease;
  will-change: transform;
}

.card:hover {
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.2);
}

.card--flipped {
  transform: rotateY(180deg);
}

.card__inner {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
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
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.25rem;
  text-align: center;
  border-radius: 12px;
  overflow: hidden;
  transform-style: preserve-3d;
  /* Ensure content is positioned correctly */
  z-index: 1;
  outline: 1px solid transparent;
}

.card__face::before {
  content: "";
  position: absolute;
  inset: 0;
  border: 6px solid rgba(0, 0, 0, 0.25);
  pointer-events: none;
  z-index: 10;
  border-radius: 12px;
  -webkit-box-shadow: inset 0 0 100px 0 rgba(0, 0, 0, 0.25);
  -moz-box-shadow: inset 0 0 100px 0 rgba(0, 0, 0, 0.25);
  box-shadow: inset 0 0 100px 0 rgba(0, 0, 0, 0.25);
}

.card__front,
.card__back {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform-style: preserve-3d;
  border-radius: 12px;
}

.card__front {
  background-color: #e7e1de;
}

.card__back {
  background-color: #e7e1de;
  transform: rotateY(180deg);
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
}

/* We'll use backface-visibility instead of display:none to allow 3D effects */
.card__front {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.card__back {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform: rotateY(180deg);
}

.card__shine {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 100;
  transition: background-position 250ms linear;
  border-radius: 12px;
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
