<template>
  <div class="pack-grid">
    <!-- The card components are divs, not buttons, and they are shared with the
         live game — so the keyboard affordance is added out here rather than by
         changing them. -->
    <div
      v-for="(card, i) in cards"
      :key="card.id"
      class="pack-grid__card"
      role="button"
      tabindex="0"
      :aria-label="t('labs.enlarge_card', { text: card.text ?? t('labs.picture_card') })"
      @click="emit('select', i)"
      @keydown.enter.prevent="emit('select', i)"
      @keydown.space.prevent="emit('select', i)"
    >
      <BlackCard
        v-if="type === 'black'"
        disable-hover
        :card-id="card.id"
        :text="card.text ?? ''"
        :card-pack="card.pack ?? ''"
        :num-pick="card.pick ?? 1"
        :image-url="card.imageKey ? getCardImageUrl(card.imageKey) : undefined"
        :attachment="card.attachment"
        :three-deffect="false"
      />
      <WhiteCard
        v-else
        flat
        disable-hover
        :card-id="card.id"
        :text="card.text ?? ''"
        :card-pack="card.pack ?? ''"
        :image-url="card.imageKey ? getCardImageUrl(card.imageKey) : undefined"
        :attachment="card.attachment"
        :three-deffect="false"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
// Renders a page of browsable cards using the real in-game card components, so
// what Labs shows is exactly what a player is dealt — picture cards, pick
// badges, pack footers and all. `flat` on the white cards skips preserve-3d
// (these never flip), which keeps a 24-card page cheap and dodges the Firefox
// GPU tiling artifacts noted in WhiteCard.vue.
import type { BrowsableCard } from "~/types/cardBrowser";
import { getCardImageUrl } from "~/utils/cardImage";

defineProps<{
  cards: BrowsableCard[];
  type: "white" | "black";
}>();

const emit = defineEmits<{ (e: "select", index: number): void }>();

const { t } = useI18n();
</script>

<style scoped>
.pack-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  justify-content: center;
  align-items: flex-start;
}

/* Browsing wants thumbnails, not table-sized cards. .card-scaler's own
   clamp(10rem*s, 12vw*s, 18rem*s) is tuned for a hand of a few cards, where the
   12vw term is what makes them fill the table — in a 24-card grid on a wide
   monitor that pinned every card to the 18rem cap. Overriding the width outright
   keeps the size predictable at every breakpoint instead of swinging with the
   viewport; the card's internals are sized in cqi off .card-scaler's own
   container query, so they scale down with it and stay legible. */
.pack-grid :deep(.card-scaler) {
  width: clamp(140px, 6vw, 170px);
}

/* Hover/focus affordance so the cards read as clickable, matching .pack-tile. */
.pack-grid__card {
  border-radius: 14px;
  cursor: pointer;
  transition: transform 0.18s ease;
}
.pack-grid__card:hover,
.pack-grid__card:focus-visible {
  transform: translateY(-4px);
}
.pack-grid__card:focus-visible {
  outline: 2px solid #a9ed87;
  outline-offset: 4px;
}
@media (prefers-reduced-motion: reduce) {
  .pack-grid__card {
    transition: none;
  }
  .pack-grid__card:hover,
  .pack-grid__card:focus-visible {
    transform: none;
  }
}
@media (max-width: 560px) {
  .pack-grid {
    gap: 0.75rem;
  }
}
</style>
