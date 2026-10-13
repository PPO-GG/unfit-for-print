<script lang="ts" setup>
import { ref, onMounted, watch } from "vue";
import { useWhiteDeckPosition } from "~/composables/useWhiteDeckPosition";
import { gsap } from "gsap";

const props = defineProps({
  backLogoUrl: {
    type: String,
    default: "/img/ufp.svg",
  },
  maskUrl: {
    type: String,
    default: "/img/textures/hexa.png",
  },
  /** Size scale as a percentage. 100 = default size, 50 = half size, etc. */
  scale: {
    type: Number,
    default: 100,
  },
  /** When true, the deck is clickable for manual draw mode. */
  interactive: {
    type: Boolean,
    default: false,
  },
  /** When true, show a pulsing draw indicator on the topmost card. */
  needsDraw: {
    type: Boolean,
    default: false,
  },
  /** How many cards a draw would deal; shown as a badge while `needsDraw`. */
  drawCount: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits<{
  (e: "draw"): void;
}>();

const { t } = useI18n();

function onActivate() {
  if (props.interactive) emit("draw");
}

const deckRef = ref<HTMLElement | null>(null);
const { registerDeck, isDealing } = useWhiteDeckPosition();

onMounted(() => {
  if (deckRef.value) {
    registerDeck(deckRef.value);
  }
});

// Pulse animation when cards are dealt from the deck
watch(isDealing, (dealing) => {
  if (dealing && deckRef.value) {
    gsap.fromTo(
      deckRef.value,
      { scale: 1 },
      {
        scale: 0.92,
        duration: 0.15,
        ease: "power2.in",
        yoyo: true,
        repeat: 1,
      },
    );
  }
});
</script>

<template>
  <div
    ref="deckRef"
    data-deck="white"
    class="white-deck-wrapper"
    :class="{
      'white-deck--dealing': isDealing,
      'white-deck--interactive': props.interactive,
      'white-deck--needs-draw': props.needsDraw,
    }"
    :role="props.interactive ? 'button' : undefined"
    :tabindex="props.interactive ? 0 : undefined"
    :aria-label="
      props.interactive ? t('game.deck_draw_aria', props.drawCount) : undefined
    "
    @click="onActivate"
    @keydown.enter.self.prevent="onActivate"
  >
    <!-- Stack effect with multiple cards -->
    <div
      v-for="i in 5"
      :key="`white-stack-${i}`"
      class="white-deck-layer"
      :style="{
        top: `${i * 2}px`,
        left: `${i * 2}px`,
        zIndex: 5 - i,
      }"
    >
      <WhiteCard
        :backLogoUrl="backLogoUrl"
        :flipped="true"
        :mask-url="maskUrl"
        :shine="false"
        :threeDeffect="false"
        :disableHover="true"
        :flat="true"
        :scale="scale"
      />
      <div
        v-if="i === 1 && props.needsDraw"
        class="draw-indicator"
      >
        <UIcon
          name="i-solar-circle-bottom-down-bold"
          class="draw-indicator-icon"
        />
      </div>
    </div>
    <!-- After the layers: the first layer sizes the stack via :first-child. -->
    <span v-if="props.needsDraw && props.drawCount > 0" class="draw-badge">
      +{{ props.drawCount }}
    </span>
  </div>
</template>

<style scoped>
.white-deck-wrapper {
  position: relative;
  width: fit-content;
}

.white-deck-layer {
  position: absolute;
  transform: translate(-12px, -12px);
}

/* First layer is relative to establish container size */
.white-deck-layer:first-child {
  position: relative;
}

.white-deck--dealing {
  filter: brightness(1.2);
  transition: filter 0.3s ease;
}

.white-deck--interactive {
  cursor: pointer;
  border-radius: 14px;
  outline: none;
}

/* A glow around the whole stack, not just the top card: the old grey icon on
   a grey card back was easy to play an entire game without noticing. */
.white-deck--needs-draw {
  --draw-accent: var(--lb-accent, oklch(78% 0.2 195));
  filter: drop-shadow(0 0 10px color-mix(in oklch, var(--draw-accent) 70%, transparent));
  animation: deck-glow 1.8s ease-in-out infinite;
}

.white-deck--interactive:focus-visible {
  filter: drop-shadow(0 0 0 var(--draw-accent)) drop-shadow(0 0 14px var(--draw-accent));
}

@keyframes deck-glow {
  50% {
    filter: drop-shadow(0 0 20px var(--draw-accent));
  }
}

.draw-badge {
  position: absolute;
  top: -22px;
  right: -14px;
  z-index: 20;
  min-width: 34px;
  height: 34px;
  padding: 0 8px;
  border-radius: 17px;
  display: grid;
  place-items: center;
  background: var(--draw-accent);
  color: #05060d;
  font-family: "Archivo Black", sans-serif;
  font-size: 0.95rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}

.draw-indicator {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 10;
  color: var(--draw-accent);
}

.draw-indicator-icon {
  width: 50%;
  height: 50%;
  animation: draw-pulse 1.5s ease-in-out infinite;
}

@keyframes draw-pulse {
  0%,
  100% {
    opacity: 0.7;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .white-deck--needs-draw,
  .draw-indicator-icon {
    animation: none;
  }
}
</style>
