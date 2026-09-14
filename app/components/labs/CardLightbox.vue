<template>
  <UModal
    v-model:open="open"
    :title="packTitle"
    :description="positionLabel"
    :ui="{ content: 'card-lightbox' }"
  >
    <template #body>
      <div class="lightbox" @keydown="onKeydown" tabindex="-1" ref="shell">
        <button
          v-if="total > 1"
          class="lightbox__nav lightbox__nav--prev"
          type="button"
          :aria-label="t('labs.prev_card')"
          @click="emit('step', -1)"
        >
          <Icon name="solar:alt-arrow-left-bold-duotone" />
        </button>

        <div class="lightbox__stage">
          <!-- Full presentation restored here: the grid renders cards flat for
               performance, but at this size the mouse tilt is worth having.
               No `shine` — it renders only inside the card's back face, so it
               is invisible on a card that never flips, and without a maskUrl it
               resolves url(undefined) and fires a 404 per card. -->
          <div v-if="!card" class="lightbox__pending">
            <Icon name="lucide:loader-circle" class="animate-spin" />
          </div>
          <div
            v-else
            class="lightbox__card"
            :class="{ 'lightbox__card--pending': pending }"
            :aria-busy="pending"
          >
            <BlackCard
              v-if="type === 'black'"
              :key="card.id"
              :card-id="card.id"
              :text="card.text ?? ''"
              :card-pack="card.pack ?? ''"
              :pack-display-name="card.packDisplayName"
              :pack-series="card.packSeries"
              :num-pick="card.pick ?? 1"
              :image-url="
                card.imageKey ? getCardImageUrl(card.imageKey) : undefined
              "
              :attachment="card.attachment"
              three-deffect
              :thickness="cardThickness"
              :tilt-degrees="cardTilt"
              :scale="lightboxScale"
            />
            <WhiteCard
              v-else
              :key="card.id"
              :card-id="card.id"
              :text="card.text ?? ''"
              :card-pack="card.pack ?? ''"
              :pack-display-name="card.packDisplayName"
              :pack-series="card.packSeries"
              :image-url="
                card.imageKey ? getCardImageUrl(card.imageKey) : undefined
              "
              :attachment="card.attachment"
              three-deffect
              :thickness="cardThickness"
              :tilt-degrees="cardTilt"
              :scale="lightboxScale"
            />
            <div v-if="pending" class="lightbox__spinner">
              <span class="lightbox__halo">
                <Icon name="lucide:loader-circle" class="animate-spin" />
              </span>
            </div>
          </div>
        </div>

        <button
          v-if="total > 1"
          class="lightbox__nav lightbox__nav--next"
          type="button"
          :aria-label="t('labs.next_card')"
          @click="emit('step', 1)"
        >
          <Icon name="solar:alt-arrow-right-bold-duotone" />
        </button>

        <div class="lightbox__meta">
          <span class="lightbox__chip">{{ typeLabel }}</span>
          <span
            v-if="type === 'black' && !pending && (card?.pick ?? 1) > 1"
            class="lightbox__chip"
          >
            {{ t("labs.pick_n", { count: card?.pick }) }}
          </span>
          <span v-if="total > 1" class="lightbox__position">
            {{ position.toLocaleString() }} / {{ total.toLocaleString() }}
          </span>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script lang="ts" setup>
// Enlarged view of one browsable card. Purely presentational: the parent owns
// the position within the whole result set and does the paging, because
// stepping past the end of a page has to trigger a fetch. This component just
// renders whatever card it is handed and asks to move.
import type { BrowsableCard } from "~/types/cardBrowser";
import { getCardImageUrl } from "~/utils/cardImage";
import { packLabel } from "~/utils/packName";

const props = defineProps<{
  /**
   * The card to show. While `pending`, this is the last card that resolved
   * (kept on stage so a page fetch does not blink it out), or null if none has.
   */
  card: BrowsableCard | null;
  /** The page holding `position` is still loading. */
  pending?: boolean;
  type: "white" | "black";
  /** 1-based position across the entire filtered result set. */
  position: number;
  total: number;
}>();

const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ (e: "step", delta: number): void }>();

const shell = ref<HTMLElement | null>(null);

const { t } = useI18n();

// The same "Series: Name" the card's own footer shows, so the lightbox header
// does not contradict the card inside it. No series prefix to derive from
// here — one card knows only its own pack — so the metadata is the only
// source, exactly as in the footer.
const packTitle = computed(() =>
  props.card?.pack
    ? packLabel(props.card.pack, {
        displayName: props.card.packDisplayName,
        series: props.card.packSeries,
      }).full
    : t("labs.card"),
);

const typeLabel = computed(() =>
  t(props.type === "black" ? "labs.prompt" : "labs.answer"),
);
const positionLabel = computed(() =>
  t("labs.lightbox_position", {
    type: typeLabel.value,
    position: props.position.toLocaleString(),
    total: props.total.toLocaleString(),
  }),
);

// Bigger than the grid thumbnails but still bounded, so a tall prompt card fits
// a laptop viewport without the modal scrolling.
const lightboxScale = 100;

// Edge depth, as a percentage of the card's own width. Real card stock is ~0.5%
// of a card's width, which at this size is a sub-pixel nothing - so it is
// exaggerated until it actually reads as an object. Ignored on Firefox.
const cardThickness = 4.5;

// Steeper than the in-game tilt. The rim's apparent width is the thickness
// times the sine of the angle, so this is the knob that actually shows the
// edge off -- and nothing is riding on a card you are only browsing.
const cardTilt = 26;

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  emit("step", event.key === "ArrowLeft" ? -1 : 1);
}

// The modal body is what receives the arrow keys, so it has to take focus when
// it opens.
watch(open, async (isOpen) => {
  if (!isOpen) return;
  await nextTick();
  shell.value?.focus();
});
</script>

<style scoped>
.lightbox {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas: "prev stage next" "meta meta meta";
  align-items: center;
  gap: 1rem;
  outline: none;
}
.lightbox__stage {
  grid-area: stage;
  display: flex;
  justify-content: center;
}

/* The card is rendered at --lb-card-ss times its visual size and scaled back
   down, so the downsample is what antialiases the tilted card's edges --
   Chromium rasterizes a promoted 3D layer once and then transforms the texture,
   giving the silhouette no antialiasing of its own. This box reserves the
   visual footprint; the scaler inside it is the oversized one. */
.lightbox__card {
  --lb-card-ss: 2;
  --lb-card-w: clamp(200px, 46vh, 300px);
  position: relative;
  width: var(--lb-card-w);
  aspect-ratio: 3 / 4;
}
.lightbox__card :deep(.card-scaler) {
  --card-ss: var(--lb-card-ss);
  position: absolute;
  top: 0;
  left: 0;
  width: calc(var(--lb-card-w) * var(--lb-card-ss));
  /* Perspective is measured in the oversized space, so it has to grow with it
     or the tilt reads stronger here than anywhere else in the app. */
  perspective: calc(800px * var(--lb-card-ss));
  transform: scale(calc(1 / var(--lb-card-ss)));
  transform-origin: top left;
}
.lightbox__card :deep(.card-scaler) {
  transition:
    opacity 0.15s ease,
    filter 0.15s ease;
}
.lightbox__card--pending :deep(.card-scaler) {
  opacity: 0.45;
  filter: saturate(0.6);
}
.lightbox__spinner {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
/* A dark disc so the spinner reads over the card's own text. */
.lightbox__halo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 999px;
  background: rgba(5, 6, 13, 0.78);
  box-shadow: 0 0 1.5rem 0.6rem rgba(5, 6, 13, 0.5);
  color: #a9ed87;
  font-size: 1.75rem;
}
.lightbox__pending {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a9ed87;
  font-size: 1.75rem;
  width: clamp(200px, 46vh, 300px);
  aspect-ratio: 3 / 4;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 14px;
}
.lightbox__nav {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: #e5e8f1;
  cursor: pointer;
  font-size: 1.15rem;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    opacity 0.18s ease;
}
.lightbox__nav:hover:not(:disabled),
.lightbox__nav:focus-visible {
  border-color: rgba(169, 237, 135, 0.55);
  background: rgba(140, 220, 120, 0.14);
}
.lightbox__nav:disabled {
  opacity: 0.4;
  cursor: default;
}
.lightbox__nav--prev {
  grid-area: prev;
}
.lightbox__nav--next {
  grid-area: next;
}
.lightbox__meta {
  grid-area: meta;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.lightbox__chip {
  padding: 0.2rem 0.5rem;
  border: 1px solid rgba(169, 237, 135, 0.4);
  border-radius: 999px;
  color: #a9ed87;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.55rem;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}
.lightbox__position {
  margin-left: auto;
  color: #8891b4;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem;
  letter-spacing: 0.09em;
}
@media (max-width: 560px) {
  .lightbox {
    gap: 0.5rem;
  }
  .lightbox__nav {
    width: 2rem;
    height: 2rem;
  }
  .lightbox__position {
    margin-left: 0;
  }
}
</style>
