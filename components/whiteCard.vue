<template>
  <div class="card-container">
    <div
      ref="card"
      class="card"
      @mousemove="handleMouseMove"
      @mouseleave="resetTransform"
      :class="{ 'card--flipped': flipped }"
    >
      <div class="card__inner">
        <!-- Front Side -->
        <div class="card__face card__front">
          <slot name="front">
            <div class="card-content p-4 text-4xl">
              <p>{{ cardText }}</p>
              <div class="absolute bottom-0 left-0 m-3 text-xl opacity-10 hover:opacity-50 transition-opacity duration-500">
                <Icon name="mdi:cards"  class="align-middle text-slate-900"/>
                <span class="text-sm align-middle ml-1 text-slate-900">{{ cardPack }}</span>
                <span class="text-sm align-middle ml-1 text-slate-900">{{ cardId }}</span>
              </div>
            </div>
          </slot>
        </div>

        <!-- Back Side -->
        <div class="card__face card__back">
          <slot name="back">
            <div class="card-content">
              <img
                :src="backLogoUrl"
                alt="Card Back Logo"
                class="w-48 opacity-85"
                draggable="false"
              />
            </div>
          </slot>
          <div v-if="shine" class="card__shine" :style="shineStyle"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSound } from "@vueuse/sound";
import { useAppwrite } from "~/composables/useAppwrite";

const flipSfx = [
  '/sounds/sfx/flip1.wav',
  '/sounds/sfx/flip2.wav',
  '/sounds/sfx/flip3.wav'
]
const sounds = flipSfx.map(src => useSound(src, { volume: 0.75 }))

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function playRandomFlip() {
  const i = Math.floor(Math.random() * sounds.length)
  const playbackRate = randomBetween(0.95, 1.05)
  sounds[i].play({ playbackRate })
}

const props = defineProps<{
  cardId: string
  text?: string
  cardPack?: string
  backLogoUrl?: string
  flipped?: boolean
  threeDeffect?: boolean
  shine?: boolean
  maskUrl?: string
}>();

const fallbackText = ref('');
const cardText = computed(() => props.text || fallbackText.value);
const cardPack = ref(props.cardPack || '');

const card = ref<HTMLElement | null>(null);
const rotation = ref({ x: 0, y: 0 });
const shineOffset = ref({ x: 0, y: 0 });

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
    opacity: 0.25,
    transition: "background-position 250ms linear, background 250ms linear",
  };
});

function handleMouseMove(e: MouseEvent) {
  if (!card.value) return;

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
  const flipTransform = props.flipped ? "rotateY(180deg)" : "";
  const tiltTransform = `
    rotateX(${rotateX * intensity}deg)
    rotateY(${rotateY * intensity}deg)
  `;

  card.value.style.transform = `${flipTransform} ${tiltTransform}`;
}

function resetTransform() {
  if (card.value) {
    rotation.value = { x: 0, y: 0 };
    applyTransform(0, 0);
  }
}

watch(
  () => props.flipped,
  (newValue, oldValue) => {
    if (newValue !== oldValue) {
      // Only play when the value actually changes
      playRandomFlip();
    }
  }
);

watch(
  () => props.flipped,
  () => {
    applyTransform(rotation.value.x, rotation.value.y);
  },
  { immediate: true }
);

onMounted(async () => {
  if (!props.text) {
    const { databases } = useAppwrite();
    if (!databases) return;
    const config = useRuntimeConfig();
    const doc = await databases.getDocument(config.public.appwriteDatabaseId, config.public.appwriteWhiteCardCollectionId, props.cardId);
    fallbackText.value = doc.text;
    cardPack.value = doc.pack || 'core';
  }
  resetTransform();
  animateShine();
});
</script>

<style scoped>
.card-container {
  perspective: 1500px;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 300px;
  height: 400px;
  margin: 2rem;
  -webkit-touch-callout: none; /* iOS Safari */
  -webkit-user-select: none; /* Safari */
  -khtml-user-select: none; /* Konqueror HTML */
  -moz-user-select: none; /* Old versions of Firefox */
  -ms-user-select: none; /* Internet Explorer/Edge */
  user-select: none;
}

.card {
  width: 100%;
  height: 100%;
  background: transparent;
  border-radius: 12px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  transform-style: preserve-3d;
  cursor: pointer;
  position: relative;
  transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275),
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
  -webkit-box-shadow: inset 0px 0px 100px 0px rgba(0, 0, 0, 0.25);
  -moz-box-shadow: inset 0px 0px 100px 0px rgba(0, 0, 0, 0.25);
  box-shadow: inset 0px 0px 100px 0px rgba(0, 0, 0, 0.25);
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
  background-color: rgb(231, 225, 222);
}
.card__back {
  background-color: rgba(231, 225, 222);
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
  z-index: 100; /* Higher z-index to ensure it's on top */
  transition: background-position 250ms linear;
  border-radius: 12px;
  /* Make sure shine is on top of content */
  pointer-events: none;
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
  color: black;
  border-radius: 12px;
}

/* Ensure actual content is above the overlay */
.frontside-text,
.backside-logo {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}
.frontside-text {
  padding: 1rem;
  text-align: center;
  font-family: "Bebas Neue", sans-serif;
  color: black;
}
</style>
