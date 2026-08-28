<template>
  <div
    class="admin-card-preview group relative select-none"
    :class="[isBlack ? 'card--black' : 'card--white']"
    @click="$emit('click')"
  >
    <!-- Active status badge -->
    <div class="absolute top-1.5 right-1.5 z-20">
      <span
        class="inline-block w-2 h-2 rounded-full"
        :class="
          active
            ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]'
            : 'bg-red-500/60'
        "
      />
    </div>

    <div class="card-spine" />
    <span class="card-spine-label" aria-hidden="true">UNFIT · FOR · PRINT</span>

    <img
      v-if="imageUrl"
      class="card-image"
      :src="imageUrl"
      :style="imageStyle"
      alt=""
      draggable="false"
    />
    <div v-else ref="cardBodyEl" class="card-body">
      <p ref="cardTextEl" lang="en" class="card-body-text" v-html="formattedText" />
    </div>

    <img
      class="card-watermark"
      src="/img/unfit_logo_alt.png"
      alt=""
      aria-hidden="true"
      draggable="false"
    />

    <div class="card-footer">
      <span class="card-footer-pack">{{ pack }}</span>
      <span v-if="isBlack && pick && pick > 1" class="card-footer-pick">PICK {{ pick }}</span>
    </div>

    <!-- Hover action overlay -->
    <div class="action-overlay">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useFitText } from "~/composables/useFitText";
import type { CardAttachmentConfig } from "~/types/card";
import { DEFAULT_CARD_ATTACHMENT } from "~/utils/cardAttachmentDefaults";

const props = defineProps<{
  text: string;
  pack: string;
  active?: boolean;
  type: "white" | "black";
  pick?: number;
  imageUrl?: string;
  attachment?: CardAttachmentConfig | null;
}>();

defineEmits(["click"]);

const isBlack = computed(() => props.type === "black");

const cardBodyEl = ref<HTMLElement | null>(null);
const cardTextEl = ref<HTMLElement | null>(null);
const cardText = computed(() => props.text);
useFitText(cardBodyEl, cardTextEl, cardText, { maxRatio: 0.16, maxRem: 1.4 });

const imageStyle = computed(() => {
  const a = props.attachment ?? DEFAULT_CARD_ATTACHMENT;
  return { transform: `translate(${a.offsetX * 100}%, ${a.offsetY * 100}%) scale(${a.scale})` };
});

const formattedText = computed(() => {
  if (!isBlack.value) return props.text;
  // Replace underscores with blank fill lines (matching the real BlackCard component)
  return props.text.replace(
    /_/g,
    '<span style="display:inline-block;width:38%;height:0.75em;vertical-align:-2px;border-bottom:2px solid rgba(255,255,255,.75);margin:0 4px;"></span>',
  );
});
</script>

<style scoped>
.admin-card-preview {
  aspect-ratio: 3 / 4;
  border-radius: 10px;
  cursor: pointer;
  overflow: hidden;
  position: relative;
  container-type: inline-size;
  width: 100%;
  transition:
    transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.18s ease;
}

.admin-card-preview:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  z-index: 10;
}

/* ── Black card ── */
.card--black {
  background-color: #0d0f1a;
  color: #f6f3ea;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.card--black .card-spine {
  background: #f5d442;
}

.card--black .card-spine-label {
  color: #0d0f1a;
}

.card--black .card-body-text {
  color: #f6f3ea;
}

.card--black .card-footer-pack {
  color: rgba(255, 255, 255, 0.55);
}

/* ── White card ── */
.card--white {
  background-color: #f6f3ea;
  color: #0d0f1a;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.card--white .card-spine {
  background: #c32c4c;
}

.card--white .card-spine-label {
  color: #f6f3ea;
}

.card--white .card-body-text {
  color: #0d0f1a;
}

.card--white .card-footer-pack {
  color: rgba(13, 15, 26, 0.55);
}

/* ── Showbill V4 layout (mirrors BlackCard.vue / WhiteCard.vue) ── */
.card-spine {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5cqi;
  pointer-events: none;
}

.card-spine-label {
  position: absolute;
  left: 2.5cqi;
  top: 50%;
  transform: translateY(-50%) rotate(-90deg);
  transform-origin: center;
  font-family: "Archivo Black", sans-serif;
  font-size: 2.6cqi;
  letter-spacing: 0.28em;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}

.card-body {
  position: absolute;
  left: 9cqi;
  right: 9cqi;
  top: 7cqi;
  bottom: 22cqi;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.card-body-text {
  font-family: "Archivo Black", sans-serif;
  line-height: 1.08;
  letter-spacing: -0.015em;
  text-transform: uppercase;
  margin: 0;
  overflow-wrap: break-word;
  -webkit-hyphens: auto;
  hyphens: auto;
  width: 100%;
}

.card-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-watermark {
  position: absolute;
  right: -6cqi;
  bottom: -4cqi;
  width: 62cqi;
  height: auto;
  opacity: 0.08;
  pointer-events: none;
  user-select: none;
}

.card-footer {
  position: absolute;
  left: 9cqi;
  right: 6cqi;
  bottom: 5cqi;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  pointer-events: none;
}

.card-footer-pack {
  font-family: "JetBrains Mono", monospace;
  font-size: 2.6cqi;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70cqi;
}

.card-footer-pick {
  font-family: "Archivo Black", sans-serif;
  font-size: 4.2cqi;
  letter-spacing: 0.04em;
  line-height: 1;
}

/* ── Hover action overlay ── */
.action-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.18s ease;
  z-index: 15;
  border-radius: 10px;
}

.admin-card-preview:hover .action-overlay {
  opacity: 1;
}
</style>
