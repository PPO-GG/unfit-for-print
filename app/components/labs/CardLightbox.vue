<template>
  <UModal
    v-model:open="open"
    :title="card?.pack || 'Card'"
    :description="positionLabel"
    :ui="{ content: 'card-lightbox' }"
  >
    <template #body>
      <div class="lightbox" @keydown="onKeydown" tabindex="-1" ref="shell">
        <button
          v-if="total > 1"
          class="lightbox__nav lightbox__nav--prev"
          type="button"
          aria-label="Previous card"
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
            <Icon name="solar:loading-bold-duotone" class="animate-spin" />
          </div>
          <BlackCard
            v-else-if="type === 'black'"
            :key="card.id"
            :card-id="card.id"
            :text="card.text ?? ''"
            :card-pack="card.pack ?? ''"
            :num-pick="card.pick ?? 1"
            :image-url="card.imageKey ? getCardImageUrl(card.imageKey) : undefined"
            :attachment="card.attachment"
            three-deffect
            :scale="lightboxScale"
          />
          <WhiteCard
            v-else
            :key="card.id"
            :card-id="card.id"
            :text="card.text ?? ''"
            :card-pack="card.pack ?? ''"
            :image-url="card.imageKey ? getCardImageUrl(card.imageKey) : undefined"
            :attachment="card.attachment"
            three-deffect
            :scale="lightboxScale"
          />
        </div>

        <button
          v-if="total > 1"
          class="lightbox__nav lightbox__nav--next"
          type="button"
          aria-label="Next card"
          @click="emit('step', 1)"
        >
          <Icon name="solar:alt-arrow-right-bold-duotone" />
        </button>

        <div class="lightbox__meta">
          <span class="lightbox__chip">{{ typeLabel }}</span>
          <span
            v-if="type === 'black' && (card?.pick ?? 1) > 1"
            class="lightbox__chip"
          >
            Pick {{ card?.pick }}
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

const props = defineProps<{
  /** Null while the page holding the current position is still loading. */
  card: BrowsableCard | null;
  type: "white" | "black";
  /** 1-based position across the entire filtered result set. */
  position: number;
  total: number;
}>();

const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ (e: "step", delta: number): void }>();

const shell = ref<HTMLElement | null>(null);

const typeLabel = computed(() =>
  props.type === "black" ? "Prompt" : "Answer",
);
const positionLabel = computed(
  () =>
    `${typeLabel.value} ${props.position.toLocaleString()} of ${props.total.toLocaleString()}`,
);

// Bigger than the grid thumbnails but still bounded, so a tall prompt card fits
// a laptop viewport without the modal scrolling.
const lightboxScale = 100;

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
.lightbox__stage :deep(.card-scaler) {
  width: clamp(200px, 46vh, 300px);
}
.lightbox__pending {
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(200px, 46vh, 300px);
  aspect-ratio: 3 / 4;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 14px;
  color: #a9ed87;
  font-size: 1.75rem;
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
