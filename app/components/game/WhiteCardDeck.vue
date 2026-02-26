<script lang="ts" setup>
import { ref, onMounted, watch } from "vue";
import { useWhiteDeckPosition } from "~/composables/useWhiteDeckPosition";
import { gsap } from "gsap";

defineProps({
  backLogoUrl: {
    type: String,
    default: "/img/ufp.svg",
  },
  maskUrl: {
    type: String,
    default: "/img/textures/hexa.png",
  },
});

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
    class="relative w-[clamp(6rem,12vw,18rem)] aspect-[3/4] outline-2 outline-slate-400/25 md:outline-offset-4 outline-offset-2 outline-dashed rounded-xl transition-[filter] duration-300"
    :class="{ 'brightness-120': isDealing }"
  >
    <!-- Stack effect with multiple cards -->
    <div
      v-for="i in 5"
      :key="`white-stack-${i}`"
      :style="{
        position: 'absolute',
        top: `${i * 2}px`,
        left: `${i * 2}px`,
        zIndex: 5 - i,
      }"
      class="w-full h-full -translate-x-3 -translate-y-3"
    >
      <WhiteCard
        :backLogoUrl="backLogoUrl"
        :flipped="true"
        :mask-url="maskUrl"
        :shine="false"
        :threeDeffect="false"
        :disableHover="true"
        :flat="true"
      />
    </div>
  </div>
</template>

<style scoped>
/* Override card component's fixed width so it inherits from the deck container */
:deep(.card-scaler) {
  width: 100% !important;
}

.brightness-120 {
  filter: brightness(1.2);
}
</style>
