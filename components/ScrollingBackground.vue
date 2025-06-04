<template>
  <!-- 45° rotated infinite‑scroll card matrix (JS‑driven for perfect wrap) -->
  <div v-if="showEffect" ref="wrapper" class="fixed inset-[-60vw] flex rotate-45 scale-[1.8] pointer-events-none z-[-1] opacity-5 ">
    <div
        v-for="(col, cIndex) in columns"
        :key="cIndex"
        class="flex-col;"
        :style="getColWrapperStyle()"
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
import { useThrottleFn, useWindowSize } from '@vueuse/core'
import { isMobile } from '@basitcodeenv/vue3-device-detect'

const props = withDefaults(defineProps<{
        speedPx?: number
        gap?: number
        scale?: number
        logoUrl?: string
        /** Disable rendering on mobile devices */
        disableOnMobile?: boolean
        /** Disable rendering on low‑performance devices */
        disableOnLowPerf?: boolean
}>(), {
        speedPx: 60,
        gap: 24,
        logoUrl: '/img/unfit_logo_alt.png',
        disableOnMobile: true,
        disableOnLowPerf: true,
})

const { width } = useWindowSize()
const isLowPerf = computed(() => typeof navigator !== 'undefined' && navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4)

const showEffect = computed(() => !(
        (props.disableOnMobile && isMobile) ||
        (props.disableOnLowPerf && isLowPerf.value)
))

const lowPerfMode = computed(() => !props.disableOnLowPerf && isLowPerf.value)

const computedScale = computed(() => {
	if (width.value < 480) return 0.3
	if (width.value < 768) return 0.45
	if (width.value < 1024) return 0.7
	return props.scale
})

const BASE_W = 300
const BASE_H = 400
const cardW = computed(() => BASE_W * (computedScale.value ?? 1))
const cardH = computed(() => BASE_H * (computedScale.value ?? 1))

const colCount = ref(0)
const rowCount = ref(0)

interface ColState { offset: number; dir: 1 | -1; cards: { key: number }[] }
const columns = reactive<ColState[]>([])
let keyCounter = 0

function rebuildGrid() {
	const vw = window.innerWidth
	const vh = window.innerHeight
        const diag = vw + vh
        const safetyFactor = lowPerfMode.value ? 0.3 : 1
	const newColCount = Math.ceil((diag / (cardW.value + props.gap)) * safetyFactor) + 3
        const rowFactor = lowPerfMode.value ? 0.5 : 1
        const newRowCount = Math.ceil((diag / (cardH.value + props.gap)) * rowFactor) + 3

	if (newColCount === colCount.value && newRowCount === rowCount.value) return

	colCount.value = newColCount
	rowCount.value = newRowCount

	const needCols = colCount.value - columns.length
	if (needCols > 0) {
		for (let i = 0; i < needCols; i++) {
			const idx = columns.length
			const dir: 1 | -1 = idx % 2 === 0 ? -1 : 1
			const cards = Array.from({ length: rowCount.value }, () => ({ key: keyCounter++ }))
			columns.push({ offset: 0, dir, cards })
		}
	} else if (needCols < 0) {
		columns.splice(newColCount) // ✅
	}

	columns.forEach(col => {
		const diff = rowCount.value - col.cards.length
		if (diff > 0) {
			for (let i = 0; i < diff; i++) col.cards.push({ key: keyCounter++ })
		} else if (diff < 0) {
			col.cards.splice(diff)
		}
		col.offset = 0
	})
}

/* Animation loop */
let last = 0, raf = 0
const travel = ref(0)

watch([cardH, () => props.gap], () => {
	travel.value = cardH.value + props.gap
}, { immediate: true })

function tick(ts: number) {
	if (!last) last = ts
	const dt = (ts - last) / 1000
	last = ts
	const step = props.speedPx * dt
	columns.forEach(col => {
		col.offset += step * col.dir
		if (col.dir === -1 && col.offset <= -travel.value) {
			col.offset += travel.value
			col.cards.push(col.cards.shift()!)
		}
		if (col.dir === 1 && col.offset >= travel.value) {
			col.offset -= travel.value
			col.cards.unshift(col.cards.pop()!)
		}
	})
	raf = requestAnimationFrame(tick)
}

const rebuildGridThrottled = useThrottleFn(rebuildGrid, 100)
onMounted(() => {
        rebuildGrid()
        window.addEventListener('resize', rebuildGridThrottled)
        if (showEffect.value) raf = requestAnimationFrame(tick)
})

watch(showEffect, val => {
        if (val) {
                last = 0
                raf = requestAnimationFrame(tick)
        } else {
                cancelAnimationFrame(raf)
        }
})
onUnmounted(() => {
        window.removeEventListener('resize', rebuildGridThrottled)
        cancelAnimationFrame(raf)
})
watch([() => props.scale, () => props.gap, showEffect], () => {
        if (showEffect.value) rebuildGrid()
})

/* —— inline styles —— */
function getColWrapperStyle() { // 🔥
	return {
		width: `${cardW.value + props.gap}px`,
		paddingRight: `${props.gap / 2}px`,
		paddingLeft: `${props.gap / 2}px`,
		boxSizing: 'border-box'
	}
}

const cardBaseStyle = computed(() => ({
	width: `${cardW.value}px`,
	height: `${cardH.value}px`,
	marginBottom: `${props.gap}px`,
	'--logo-size': `${Math.max(20, (computedScale.value ?? 1) * 100)}%`
}))
</script>

<style scoped>
.col-inner { will-change:transform; }

.card__back {
  width: 100%;
  height: 100%;
  position:relative;
  border-radius:12px;
  overflow:hidden;
  box-shadow:0 4px 12px rgb(0 0 0 /.18);
  background-repeat:no-repeat, repeat;
  background-position:center 50%, center;
  --logo-size: 45%;
  background-size: var(--logo-size);
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
	content: "";
	position: absolute;
	inset: 0;
	border-radius: 12px;
	opacity: 0.04;
	animation: glowPulse 8s ease-in-out infinite alternate;
	pointer-events: none;
	background: radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, transparent 70%);
}
@keyframes shine {
	0% {
		transform: translate(-120%, -50%) rotate(20deg);
	}
	100% {
		transform: translate(120%, 50%) rotate(20deg);
	}
}
@keyframes glowPulse {
	0% { opacity: 0.02; transform: scale(1); }
	100% { opacity: 0.08; transform: scale(1.02); }
}
.card__back::after {
	content: "";
	position: absolute;
	top: -50%;
	left: -50%;
	width: 200%;
	height: 200%;
	background: linear-gradient(120deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 70%);
	opacity: .08;
	animation: shine 6s linear infinite;
	pointer-events: none;
	border-radius: 50%;
}
</style>
