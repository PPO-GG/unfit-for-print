<template>
  <!-- 45° rotated infinite‑scroll card matrix (JS‑driven for perfect wrap) -->
  <div ref="wrapper" class="scroll-bg">
    <div
        v-for="(col, cIndex) in columns"
        :key="cIndex"
        class="scroll-col"
        :style="getColWrapperStyle(cIndex)"
    >
      <!-- moving stack wrapper -->
      <div class="col-inner" :style="{ transform: `translateY(${col.offset}px)` }">
        <div
            v-for="card in col.cards"
            :key="card.key"
            :class="['card__back', cIndex % 2 === 0 ? 'white' : 'black']"
            :style="cardBaseStyle"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'

const props = withDefaults(defineProps<{
  speedPx?: number
  gap?: number
  scale?: number
  logoUrl?: string
}>(), {
  speedPx: 60,
  gap: 24,
  scale: 1,
  logoUrl: '/img/unfit_logo_alt.png',
})

/* Base card dimensions */
const BASE_W = 300
const BASE_H = 400
const cardW  = computed(() => BASE_W * props.scale)
const cardH  = computed(() => BASE_H * props.scale)

/* Column + row counts */
const colCount = ref(0)
const rowCount = ref(0)

/* Column reactive state */
interface ColState { offset:number; dir:1|-1; cards:{key:number}[] }
const columns = reactive<ColState[]>([])
let keyCounter = 0

function rebuildGrid () {
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Bounding box for the 45°‑rotated rectangle
  const diag = vw + vh
  colCount.value = Math.ceil(diag / (cardW.value + props.gap)) + 3
  rowCount.value = Math.ceil(diag / (cardH.value + props.gap)) + 3

  // --- dev metric ---
  console.info(`[ScrollingBackground] cols:${colCount.value} rows:${rowCount.value} total:${colCount.value * rowCount.value}`)

  const needCols = colCount.value - columns.length

  // Add columns if we need more
  if (needCols > 0) {
    for (let i = 0; i < needCols; i++) {
      const idx = columns.length
      const dir: 1 | -1 = idx % 2 === 0 ? -1 : 1 // even cols scroll up
      const cards = Array.from({ length: rowCount.value }, () => ({ key: keyCounter++ }))
      columns.push({ offset: 0, dir, cards })
    }
  }
  // Remove extra columns if viewport shrank
  else if (needCols < 0) {
    columns.splice(needCols)
  }

  // Ensure each column has correct number of rows
  columns.forEach(col => {
    const diff = rowCount.value - col.cards.length
    if (diff > 0) {
      for (let i = 0; i < diff; i++) col.cards.push({ key: keyCounter++ })
    } else if (diff < 0) {
      col.cards.splice(diff)
    }
    // reset offset so new grid starts aligned
    col.offset = 0
  })
}

/* Animation loop */
let last=0, raf=0
function tick(ts:number){
  if(!last) last=ts
  const dt=(ts-last)/1000; last=ts
  const step= props.speedPx*dt
  const travel=cardH.value+props.gap
  columns.forEach(col=>{
    col.offset+=step*col.dir
    if(col.dir===-1 && col.offset<=-travel){ col.offset+=travel; col.cards.push(col.cards.shift()!) }
    if(col.dir===1 && col.offset>=travel){ col.offset-=travel; col.cards.unshift(col.cards.pop()!) }
  })
  raf=requestAnimationFrame(tick)
}

onMounted(()=>{ rebuildGrid(); window.addEventListener('resize',rebuildGrid); raf=requestAnimationFrame(tick) })
onUnmounted(()=>{ window.removeEventListener('resize',rebuildGrid); cancelAnimationFrame(raf) })
watch(()=>[props.scale,props.gap], rebuildGrid)

/* —— inline styles —— */
function getColWrapperStyle(idx:number){
  return { width:`${cardW.value}px`, marginRight:`${props.gap}px`, overflow:'hidden' }
}

const cardBaseStyle = computed(() => ({
  width: `${cardW.value}px`,
  height: `${cardH.value}px`,
  marginBottom: `${props.gap}px`,
}))

</script>

<style scoped>
.scroll-bg {
  position:fixed;
  inset:-60vh -60vw;
  display:flex;
  transform:rotate(45deg) scale(1.8);
  pointer-events:none;
  z-index:-1;
  opacity:0.05;
}
.scroll-col { display:flex; flex-direction:column; }
.col-inner { will-change:transform; }

.card__back {
  position:relative;
  border-radius:12px;
  overflow:hidden;
  box-shadow:0 4px 12px rgb(0 0 0 /.18);
  background-repeat:no-repeat, repeat;
  background-position:center 50%, center;
  background-size:45%, cover;
}
.card__back.white {
  background-image: url('/img/unfit_logo_alt_dark.png');
  color:#000;
  background-color: rgba(231, 225, 222);
  border: 6px solid rgba(0, 0, 0, 0.25);
}
.card__back.black {
  background-image: url('/img/unfit_logo_alt.png');
  background-color: rgba(28, 35, 66);
  color:#fff;
  mix-blend-mode: overlay;
  border: 6px solid rgba(255, 255, 255, 0.5);
}

.card__back::before {
  content:"";
  position:absolute;
  inset:0;
  border-radius:12px;
  pointer-events:none;
}
.card__back::after {
  content:"";
  position:absolute;
  inset:0;
  border-radius:12px;
  opacity:.08;
  mix-blend-mode:screen;
  transform:translateX(-100%);
  animation:shine 6s linear infinite;
  pointer-events:none;
}
</style>
