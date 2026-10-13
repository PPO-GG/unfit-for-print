<script setup lang="ts">
// A dashed, card-sized gap in the hand where a card is missing under manual
// draw. Tapping it draws, so the fix sits where the player is already looking
// rather than on a deck they may never have noticed.

withDefaults(
  defineProps<{
    /** Same meaning as WhiteCard's `scale`, so the gap matches its neighbours. */
    scale?: number;
  }>(),
  { scale: 100 },
);

const { t } = useI18n();
</script>

<template>
  <button
    type="button"
    class="draw-slot"
    :style="{ '--card-scale': scale / 100 }"
    :aria-label="t('game.draw_slot_aria')"
  >
    <Icon name="i-solar-add-circle-bold" class="draw-slot-icon" />
    <span class="draw-slot-label">{{ t("game.draw_slot") }}</span>
  </button>
</template>

<style scoped>
.draw-slot {
  /* Copies WhiteCard's .card-scaler width and 3:4 aspect, which are scoped to
     that component. Keep the two in step or the slot stops matching the card
     beside it. */
  width: clamp(
    calc(10rem * var(--card-scale)),
    calc(12vw * var(--card-scale)),
    calc(18rem * var(--card-scale))
  );
  aspect-ratio: 3 / 4;
  border-radius: 14px;
  border: 2px dashed var(--lb-accent, oklch(78% 0.2 195));
  /* Opaque: in the fan it overlaps its neighbour, and a see-through gap let
     that card's text bleed into it. */
  background: color-mix(in oklch, var(--lb-accent, oklch(78% 0.2 195)) 10%, #0a0d1c);
  color: var(--lb-accent, oklch(78% 0.2 195));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
  animation: draw-slot-breathe 2.4s ease-in-out infinite;
}

.draw-slot:hover,
.draw-slot:focus-visible {
  background: color-mix(in oklch, var(--lb-accent, oklch(78% 0.2 195)) 20%, #0a0d1c);
  border-style: solid;
  outline: none;
}

.draw-slot-icon {
  width: 32%;
  height: auto;
  aspect-ratio: 1;
}

.draw-slot-label {
  font-family: "Archivo Black", sans-serif;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

@keyframes draw-slot-breathe {
  50% {
    border-color: color-mix(in oklch, var(--lb-accent, oklch(78% 0.2 195)) 55%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .draw-slot {
    animation: none;
  }
}
</style>
