<script lang="ts" setup>
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    /** 'black' or 'white' */
    type: "black" | "white";
    /** Number of cards remaining in the deck */
    count: number;
    /** Maximum cards (for calculating visual height) */
    maxCount?: number;
    /** Whether clicking the stack does something (manual draw) */
    interactive?: boolean;
  }>(),
  {
    maxCount: 100,
    interactive: false,
  },
);

const emit = defineEmits<{
  (e: "click"): void;
}>();

// Show 1-5 visible layers proportional to remaining count
const visibleLayers = computed(() => {
  if (props.count <= 0) return 0;
  const ratio = props.count / props.maxCount;
  return Math.max(1, Math.min(5, Math.ceil(ratio * 5)));
});

// Vertical offset per layer (gives depth illusion)
const layerOffset = 2; // px
</script>

<template>
  <div
    class="card-stack"
    :class="[
      `card-stack--${type}`,
      {
        'card-stack--interactive': interactive,
        'card-stack--empty': count <= 0,
      },
    ]"
    @click="interactive && emit('click')"
  >
    <!-- Glow platform beneath the stack -->
    <div class="card-stack-glow" />

    <!-- Stacked card layers -->
    <div
      v-for="i in visibleLayers"
      :key="`stack-${i}`"
      class="card-stack-layer"
      :style="{
        transform: `translate(${i * layerOffset}px, ${-i * layerOffset}px)`,
        zIndex: visibleLayers - i,
        opacity: i === visibleLayers ? 1 : 0.7 + (i / visibleLayers) * 0.3,
      }"
    >
      <BlackCard
        v-if="type === 'black'"
        :flipped="true"
        :shine="false"
        :three-deffect="false"
        :scale="75"
      />
      <WhiteCard
        v-else
        :flipped="true"
        :disable-hover="true"
        :flat="true"
        :shine="false"
        back-logo-url="/img/ufp.svg"
        :scale="75"
      />
    </div>

    <!-- Empty state -->
    <div v-if="count <= 0" class="card-stack-empty">
      <UIcon name="i-solar-layers-minimalistic-bold-duotone" class="text-2xl" />
    </div>

    <!-- Interactive prompt -->
    <div v-if="interactive && count > 0" class="card-stack-prompt">Draw</div>
  </div>
</template>

<style scoped>
.card-stack {
  position: relative;
  /* Let the card's own scale prop determine size */
  width: fit-content;
}

.card-stack-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Glow platform */
.card-stack-glow {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  height: 12px;
  border-radius: 50%;
  filter: blur(8px);
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.card-stack--black .card-stack-glow {
  background: rgba(99, 102, 241, 0.2);
}

.card-stack--white .card-stack-glow {
  background: rgba(226, 232, 240, 0.12);
}

/* Interactive state */
.card-stack--interactive {
  cursor: pointer;
}

.card-stack--interactive:hover .card-stack-glow {
  opacity: 1.5;
}

.card-stack--interactive:hover .card-stack-layer:last-child {
  transform: translateY(-4px) !important;
  transition: transform 0.2s ease;
}

/* Empty state */
.card-stack--empty {
  opacity: 0.3;
}

.card-stack-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  border: 1px dashed rgba(71, 85, 105, 0.3);
  border-radius: 10px;
}

/* Draw prompt */
.card-stack-prompt {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.65rem;
  color: #64748b;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.card-stack--interactive:hover .card-stack-prompt {
  opacity: 1;
}

.card-stack--interactive .card-stack-prompt {
  opacity: 1;
  animation: draw-pulse 2s ease-in-out infinite;
}

@keyframes draw-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; color: #a78bfa; }
}
</style>
