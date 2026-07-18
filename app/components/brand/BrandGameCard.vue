<!--
  A stylised UFP game card. Used for decorative previews on marketing
  pages — NOT the actual gameplay card (that lives in WhiteCard.vue /
  BlackCard.vue and keeps its existing 3D-tilt behavior).

  Renders "___" blanks in prompt text as underlined inline spans.
-->
<template>
  <div :class="['ufp-card', variant, { 'is-animating': animating }]" :style="cardStyle">
    <div class="ufp-card-body">
      <template v-for="(part, i) in parts" :key="i">
        {{ part }}
        <span v-if="i < parts.length - 1" class="blank" />
      </template>
    </div>

    <template v-if="variant === 'black'">
      <div class="brand-chip left">UNFIT<br />FOR<br />PRINT</div>
      <div v-if="pick && pick > 1" class="pick-indicator">
        PICK
        <span class="pick-pip">{{ pick }}</span>
      </div>
    </template>
    <div v-else class="brand-chip right">UNFIT<br />FOR<br />PRINT</div>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from "vue";

const props = withDefaults(
  defineProps<{
    variant: "black" | "white";
    text: string;
    /** For prompt (black) cards — number of blanks to fill. */
    pick?: number;
    /** Rotation in degrees, used when stacking several cards in a fan. */
    tilt?: number;
    /** When true, the card collapses out of view (used during shuffle). */
    animating?: boolean;
    /** Optional entry delay in ms (cascading animation). */
    delay?: number;
  }>(),
  { tilt: 0, delay: 0 },
);

const mounted = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

function scheduleMount() {
  clearTimeout(timer);
  timer = setTimeout(() => (mounted.value = true), props.delay);
}

onMounted(scheduleMount);
watch(() => props.text, () => {
  mounted.value = false;
  scheduleMount();
});
onBeforeUnmount(() => clearTimeout(timer));

const parts = computed(() => props.text.split("___"));

const cardStyle = computed<CSSProperties>(() => {
  const settled = mounted.value && !props.animating;
  return {
    transform: settled
      ? `rotate(${props.tilt}deg) translateY(0)`
      : `rotate(${props.tilt + 8}deg) translateY(20px) scale(0.94)`,
    opacity: settled ? 1 : 0,
  };
});
</script>

<style scoped>
.ufp-card-body {
  flex: 1;
}

.pick-indicator {
  position: absolute;
  bottom: 12px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
}

.pick-pip {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Archivo Black", sans-serif;
  font-size: 11px;
  background: white;
  color: #0d0f1a;
}
</style>
