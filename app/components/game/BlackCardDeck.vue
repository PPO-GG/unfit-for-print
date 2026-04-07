<script lang="ts" setup>
import { ref, watch } from "vue";
import { gsap } from "gsap";

const props = defineProps({
  blackCard: {
    type: Object,
    default: null,
  },
  flipped: {
    type: Boolean,
    default: true,
  },
  /** Size scale as a percentage. 100 = default size, 50 = half size, etc. */
  scale: {
    type: Number,
    default: 100,
  },
});

const cardRef = ref<HTMLElement | null>(null);

watch(
  () => props.blackCard,
  (newCard, oldCard) => {
    if (!newCard || newCard.id === oldCard?.id) return;
    const cardEl = cardRef.value;
    if (!cardEl) return;

    gsap.fromTo(
      cardEl,
      { x: -20, y: -30, scale: 0.8, opacity: 0, rotation: -8 },
      {
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        rotation: 0,
        duration: 0.6,
        ease: "back.out(1.4)",
      },
    );
  },
);
</script>

<template>
  <div class="black-deck-wrapper">
    <!-- Stack effect with multiple cards -->
    <div
      v-for="i in 5"
      :key="`black-stack-${i}`"
      class="black-deck-layer"
      :style="{
        top: `${i * 2}px`,
        left: `${i * 2}px`,
        zIndex: 5 - i,
      }"
    >
      <BlackCard :flipped="true" :shine="false" :three-deffect="false" :scale="scale" />
    </div>
    <!-- Top card (current black card) -->
    <div
      v-if="blackCard"
      ref="cardRef"
      class="black-deck-top"
    >
      <BlackCard
        :card-id="blackCard.id"
        :flipped="false"
        :num-pick="blackCard.pick"
        :text="blackCard.text"
        :three-deffect="true"
        :scale="scale"
      />
    </div>
  </div>
</template>

<style scoped>
.black-deck-wrapper {
  position: relative;
  width: fit-content;
}

.black-deck-layer {
  position: absolute;
  transform: translate(-12px, -12px);
}

.black-deck-top {
  position: relative;
  z-index: 10;
  transform: translate(-12px, -12px);
  transition: transform 0.3s ease;
}

.black-deck-top:hover {
  transform: translate(-12px, -32px) scale(1.05);
}
</style>
