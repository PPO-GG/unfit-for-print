<script setup lang="ts">
import type { CardTexts } from "~/types/gamecards";

interface Slide {
  key: string;
  cardIds: string[];
  playerId: string | null;
  faceDown: boolean;
  order: number; // 1-based pick order, 0 = not selected
  ringed: boolean;
  mine: boolean;
}

const props = withDefaults(
  defineProps<{
    mode: "select" | "judge";
    cardTexts: CardTexts;
    cards?: string[];
    selected?: string[];
    showOrder?: boolean;
    submissions?: Record<string, string[]>;
    order?: string[];
    revealed?: Record<string, boolean>;
    interactive?: boolean;
    highlight?: string | null;
    mine?: string | null;
    canReadAloud?: boolean;
    readingAloud?: boolean;
    scale?: number;
  }>(),
  {
    cards: () => [],
    selected: () => [],
    showOrder: false,
    submissions: () => ({}),
    order: () => [],
    revealed: () => ({}),
    interactive: true,
    highlight: null,
    mine: null,
    canReadAloud: false,
    readingAloud: false,
    scale: 100,
  },
);

const emit = defineEmits<{
  select: [cardId: string];
  reveal: [playerId: string];
  pick: [playerId: string];
  "read-aloud": [playerId: string];
}>();

const { t } = useI18n();

const slides = computed<Slide[]>(() =>
  props.mode === "select"
    ? props.cards.map((id) => {
        const order = props.selected.indexOf(id) + 1;
        return {
          key: id,
          cardIds: [id],
          playerId: null,
          faceDown: false,
          order,
          ringed: order > 0,
          mine: false,
        };
      })
    : props.order.map((pid) => ({
        key: pid,
        cardIds: props.submissions[pid] ?? [],
        playerId: pid,
        faceDown: !props.revealed[pid],
        order: 0,
        ringed: props.highlight === pid,
        mine: props.mine === pid,
      })),
);

function onTap(slide: Slide) {
  if (!props.interactive) return;
  if (props.mode === "select") {
    emit("select", slide.key);
  } else if (slide.faceDown) {
    emit("reveal", slide.playerId!);
  } else {
    emit("pick", slide.playerId!);
  }
}

// ── Dots: which slide is centred ──
const trackEl = ref<HTMLElement | null>(null);
const activeIndex = ref(0);
function onScroll() {
  const el = trackEl.value;
  const count = slides.value.length;
  if (!el || count === 0) return;
  const max = el.scrollWidth - el.clientWidth;
  activeIndex.value = max > 0 ? Math.round((el.scrollLeft / max) * (count - 1)) : 0;
}
</script>

<template>
  <div
    class="compact-carousel"
    :class="`compact-carousel--${mode}`"
  >
    <div ref="trackEl" class="compact-carousel-track" @scroll.passive="onScroll">
      <div
        v-for="slide in slides"
        :key="slide.key"
        class="compact-slide"
        :class="{
          'is-ringed': slide.ringed,
          'is-mine': slide.mine,
          'is-facedown': slide.faceDown,
          'is-interactive': interactive,
        }"
        :data-slide="slide.key"
        role="button"
        :tabindex="interactive ? 0 : -1"
        :aria-pressed="slide.ringed"
        @click="onTap(slide)"
        @keydown.enter.self.prevent="onTap(slide)"
      >
        <div class="compact-slide-stack">
          <WhiteCard
            v-for="cardId in slide.cardIds"
            :key="cardId"
            class="compact-slide-card"
            :class="{ 'is-loading': !slide.faceDown && !cardTexts[cardId]?.text }"
            :card-id="cardId"
            :text="cardTexts[cardId]?.text"
            :card-pack="cardTexts[cardId]?.pack"
            :flipped="slide.faceDown"
            :flat="mode === 'select'"
            :disable-hover="true"
            :scale="scale"
          />
        </div>
        <span v-if="showOrder && slide.order > 0" class="compact-slide-badge">
          {{ slide.order }}
        </span>
        <span v-if="slide.mine" class="compact-slide-mine">{{ t("compact.yours") }}</span>
        <span v-if="slide.faceDown && interactive" class="compact-slide-hint">
          {{ t("compact.tap_to_reveal") }}
        </span>
        <button
          v-if="canReadAloud && !slide.faceDown"
          type="button"
          class="compact-slide-speak"
          :disabled="readingAloud"
          :aria-label="t('compact.read_aloud')"
          @click.stop="emit('read-aloud', slide.playerId!)"
        >
          <Icon name="i-solar-volume-loud-bold" />
        </button>
      </div>
    </div>
    <div v-if="slides.length > 1" class="compact-carousel-dots" aria-hidden="true">
      <i
        v-for="(slide, i) in slides"
        :key="slide.key"
        :class="{ on: i === activeIndex }"
      />
    </div>
  </div>
</template>

<style scoped>
.compact-carousel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.compact-carousel-track {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  overflow-y: visible;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: 16px;
  padding: 14px 16px 10px;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}
.compact-carousel-track::-webkit-scrollbar {
  display: none;
}
.compact-slide {
  position: relative;
  flex: none;
  scroll-snap-align: center;
  border-radius: 12px;
  transition: transform 0.18s ease;
  -webkit-tap-highlight-color: transparent;
}
.compact-slide.is-interactive {
  cursor: pointer;
}
.compact-slide.is-ringed {
  transform: translateY(-8px);
  outline: 3px solid var(--lb-accent);
  outline-offset: 3px;
}
.compact-carousel--judge .compact-slide.is-ringed {
  outline-color: var(--lb-accent-yellow);
}
.compact-slide-stack {
  display: flex;
  gap: 6px;
}
.compact-slide-card.is-loading {
  animation: compact-shimmer 1.2s ease-in-out infinite;
}
@keyframes compact-shimmer {
  50% { opacity: 0.6; }
}
.compact-slide-badge {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--lb-accent);
  color: var(--lb-bg-0);
  font-family: "Archivo Black", sans-serif;
  font-size: 13px;
}
.compact-slide-mine {
  position: absolute;
  top: -9px;
  left: 14px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--lb-accent);
  color: var(--lb-bg-0);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.compact-slide-hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 18%;
  text-align: center;
  font-family: "Archivo Black", sans-serif;
  font-size: 0.8rem;
  text-transform: uppercase;
  color: var(--lb-accent-yellow);
  pointer-events: none;
}
.compact-slide-speak {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #0d0f1a;
  color: #f6f3ea;
  font-size: 18px;
}
.compact-slide-speak:disabled {
  opacity: 0.5;
}
.compact-carousel-dots {
  display: flex;
  justify-content: center;
  gap: 5px;
  padding-bottom: 4px;
}
.compact-carousel-dots i {
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background: var(--lb-ink-muted);
  transform-origin: center;
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.compact-carousel-dots i.on {
  background: var(--lb-accent);
  transform: scaleX(2.6);
}
.compact-carousel--judge .compact-carousel-dots i.on {
  background: var(--lb-accent-yellow);
}
@media (prefers-reduced-motion: reduce) {
  .compact-slide { transition: none; }
  .compact-slide-card.is-loading { animation: none; }
  .compact-carousel-dots i { transition: none; }
}
</style>
