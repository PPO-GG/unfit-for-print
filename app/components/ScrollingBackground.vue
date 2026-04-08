<template>
  <div class="w-full absolute min-h-full flex flex-col -z-10">
    <ClientOnly>
      <div
        class="fixed w-full inset-0 bg-[url('/img/textures/noise.png')] opacity-7 pointer-events-none -z-10"
      />
    </ClientOnly>
    <div
      v-if="showEffect"
      class="fixed inset-[-60vw] flex rotate-45 scale-[1.8] pointer-events-none z-[-1] opacity-5"
    >
      <div
        v-for="(col, cIndex) in columns"
        :key="cIndex"
        :style="getColWrapperStyle()"
        class="flex flex-col"
      >
        <div
          class="col-inner"
          :class="{ 'col-inner--reverse': cIndex % 2 !== 0 }"
          :style="getColInnerStyle(cIndex)"
        >
          <!-- Primary card set -->
          <div
            v-for="card in col.cards"
            :key="card.key"
            :class="['card__back', cIndex % 2 === 0 ? 'white' : 'black']"
            :style="cardBaseStyle"
          />
          <!-- Duplicate set for seamless wrap-around -->
          <div
            v-for="card in col.cards"
            :key="'d' + card.key"
            :class="['card__back', cIndex % 2 === 0 ? 'white' : 'black']"
            :style="cardBaseStyle"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { reactive, computed, onMounted, watch } from "vue";
import { useWindowSize } from "@vueuse/core";

const props = defineProps({
  speedPx: { type: Number, default: 60 },
  gap: { type: Number, default: 24 },
  scale: { type: Number, default: 1 },
  disableOnMobile: { type: Boolean, default: true },
  disableOnLowPerf: { type: Boolean, default: true },
});

const { width } = useWindowSize();

const showEffect = computed(() => true);

const computedScale = computed(() => {
  if (width.value < 480) return 0.3;
  if (width.value < 768) return 0.45;
  if (width.value < 1024) return 0.7;
  return props.scale;
});

const BASE_W = 300;
const BASE_H = 400;
const cardW = computed(() => BASE_W * computedScale.value);
const cardH = computed(() => BASE_H * computedScale.value);

interface ColState {
  cards: { key: number }[];
}

const columns = reactive<ColState[]>([]);

let keyCounter = 0;

const cols = computed(() => {
  const rawCols = Math.ceil((width.value * 1.8) / (cardW.value + props.gap));
  return Math.max(3, rawCols);
});

function rebuildGrid() {
  columns.length = 0;
  const vh = window.innerHeight;
  const diag = window.innerWidth + vh;
  const colCount = cols.value;
  const rowCount = Math.ceil(diag / (cardH.value + props.gap)) + 2;

  for (let i = 0; i < colCount; i++) {
    const cards = Array.from({ length: rowCount }, () => ({
      key: keyCounter++,
    }));
    columns.push({ cards });
  }
}

function getColWrapperStyle() {
  return {
    width: `${cardW.value + props.gap}px`,
    paddingRight: `${props.gap / 2}px`,
    paddingLeft: `${props.gap / 2}px`,
    boxSizing: "border-box" as const,
  };
}

function getColInnerStyle(index: number) {
  const count = columns[index]?.cards.length ?? 0;
  const setHeight = count * (cardH.value + props.gap);
  const duration = setHeight / props.speedPx;

  return {
    "--scroll-distance": `${setHeight}px`,
    "--scroll-duration": `${duration}s`,
  };
}

watch([width, computedScale], () => {
  if (showEffect.value) {
    rebuildGrid();
  }
});

onMounted(() => {
  if (showEffect.value) {
    rebuildGrid();
  }
});

const cardBaseStyle = computed(() => ({
  width: `${cardW.value}px`,
  height: `${cardH.value}px`,
  marginBottom: `${props.gap}px`,
  "--logo-size": `${Math.max(20, (computedScale.value ?? 1) * 100)}%`,
}));
</script>

<style scoped>
/* ── Seamless infinite scroll via CSS compositor ─────────────────────── */
.col-inner {
  will-change: transform;
  animation: scroll-up var(--scroll-duration) linear infinite;
}

.col-inner--reverse {
  animation-name: scroll-down;
}

@keyframes scroll-up {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(calc(-1 * var(--scroll-distance)));
  }
}

@keyframes scroll-down {
  from {
    transform: translateY(calc(-1 * var(--scroll-distance)));
  }
  to {
    transform: translateY(0);
  }
}

/* ── Card faces ──────────────────────────────────────────────────────── */
.card__back {
  border-radius: 12px;
  background-position: center;
  background-repeat: no-repeat;
  background-size: var(--logo-size);
}

.card__back.white {
  background-image: url("/img/unfit_logo_alt_dark.png");
  background-color: rgba(231, 225, 222);
  border: 6px solid rgba(0, 0, 0, 0.25);
}

.card__back.black {
  background-image: url("/img/unfit_logo_alt.png");
  background-color: rgba(28, 35, 66);
  border: 6px solid rgba(255, 255, 255, 0.5);
}
</style>
