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
});

const emit = defineEmits<{
  (e: "draw"): void;
}>();

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
    }"
    @click="props.interactive && emit('draw')"
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
        class="draw-indicator text-nickel-500"
      >
        <UIcon
          name="i-solar-circle-bottom-down-bold"
          class="draw-indicator-icon"
        />
      </div>
    </div>
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
}

.draw-indicator {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 10;
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
</style>
