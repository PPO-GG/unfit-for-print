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
    :class="{ 'white-deck--dealing': isDealing, 'white-deck--interactive': props.interactive }"
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
</style>
