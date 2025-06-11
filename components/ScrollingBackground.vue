<template>
	<div class="w-full bg-gradient-to-b from-slate-900 to-slate-800 absolute min-h-full flex flex-col -z-10">
		<ClientOnly>
			<div class="absolute w-full inset-0 bg-[url('/img/textures/noise.png')] opacity-7 pointer-events-none -z-10"/>
		</ClientOnly>
		<div
				v-if="showEffect"
				ref="wrapper"
				class="fixed inset-[-60vw] flex rotate-45 scale-[1.8] pointer-events-none z-[-1] opacity-5"
		>
			<div
					v-for="(col, cIndex) in columns"
					:key="cIndex"
					:ref="el => setColRef(el, cIndex)"
					:style="getColWrapperStyle()"
					class="flex flex-col"
			>
				<div class="col-inner">
					<div
							v-for="card in col.cards"
							:key="card.key"
							:class="['card__back', cIndex % 2 === 0 ? 'white' : 'black']"
							:style="cardBaseStyle"
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {ref, reactive, computed, onMounted, onUnmounted, watch} from 'vue'
import {useWindowSize} from '@vueuse/core'
import {gsap} from 'gsap'
import { nextTick } from 'vue'

const props = defineProps({
	speedPx: {type: Number, default: 60},
	gap: {type: Number, default: 24},
	scale: {type: Number, default: 1},
	disableOnMobile: {type: Boolean, default: true},
	disableOnLowPerf: {type: Boolean, default: true}
})

function getColWrapperStyle() {
	return {
		width: `${cardW.value + props.gap}px`,
		paddingRight: `${props.gap / 2}px`,
		paddingLeft: `${props.gap / 2}px`,
		boxSizing: 'border-box'
	}
}

const {width} = useWindowSize()

const showEffect = computed(() => true) // simplify for now

const computedScale = computed(() => {
	if (width.value < 480) return 0.3
	if (width.value < 768) return 0.45
	if (width.value < 1024) return 0.7
	return props.scale
})

const BASE_W = 300
const BASE_H = 400
const cardW = computed(() => BASE_W * computedScale.value)
const cardH = computed(() => BASE_H * computedScale.value)

interface ColState {
	cards: { key: number }[]
}

const columns = reactive<ColState[]>([])
const colRefs = ref<HTMLElement[]>([])

function setColRef(el: HTMLElement | null, index: number) {
	if (el) colRefs.value[index] = el
}

let keyCounter = 0

function rebuildGrid() {
	columns.length = 0
	const vw = window.innerWidth
	const vh = window.innerHeight
	const diag = vw + vh
	const colCount = Math.ceil(diag / (cardW.value + props.gap)) + 2
	const rowCount = Math.ceil(diag / (cardH.value + props.gap)) + 2

	for (let i = 0; i < colCount; i++) {
		const cards = Array.from({length: rowCount}, () => ({key: keyCounter++}))
		columns.push({cards})
	}
}

const animations: gsap.core.Tween[] = []

function animateColumns() {
	animations.forEach(anim => anim.kill())
	animations.length = 0

	colRefs.value.forEach((col, index) => {
		if (!col) return
		const dir = index % 2 === 0 ? -1 : 1
		const travel = cardH.value + props.gap
		const duration = travel / props.speedPx

		const tween = gsap.to(col.querySelector('.col-inner'), {
			y: `${dir * travel}px`,
			ease: 'none',
			duration,
			repeat: -1,
			modifiers: {
				y: (val) => `${parseFloat(val) % travel}px`
			}
		})

		animations.push(tween)
	})
}

watch(showEffect, (val) => {
	if (val) {
		rebuildGrid()
		nextTick(() => animateColumns())
	} else {
		animations.forEach(anim => anim.kill())
	}
})

onMounted(() => {
	if (showEffect.value) {
		rebuildGrid()
		nextTick(() => animateColumns())
	}
})

onUnmounted(() => {
	animations.forEach(anim => anim.kill())
})
const cardBaseStyle = computed(() => ({
	width: `${cardW.value}px`,
	height: `${cardH.value}px`,
	marginBottom: `${props.gap}px`,
	'--logo-size': `${Math.max(20, (computedScale.value ?? 1) * 100)}%`
}))
</script>

<style scoped>
.col-inner {
	will-change: transform;
}
.card__back.white {
	background-image: url('/img/unfit_logo_alt_dark.png');
	background-color: rgba(231, 225, 222);
	border: 6px solid rgba(0, 0, 0, 0.25);
}
.card__back.black {
	background-image: url('/img/unfit_logo_alt.png');
	background-color: rgba(28, 35, 66);
	border: 6px solid rgba(255, 255, 255, 0.5);
}
.card__back {
	border-radius: 12px;
	margin-bottom: 1rem;
	background-position: center;
	background-repeat: no-repeat;
	background-size: var(--logo-size);
}
</style>
