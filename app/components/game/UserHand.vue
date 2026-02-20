<script lang="ts" setup>
import {ref, computed, watch, onMounted, onUnmounted, nextTick} from 'vue'
import {useSfx} from '@/composables/useSfx'
import {gsap} from 'gsap'

const {t} = useI18n()
const setters = ref<((val: string) => void)[]>([])
const cardRefs = ref<HTMLElement[]>([])

const props = defineProps<{
	cards: string[]
	disabled?: boolean
	cardsToSelect?: number
}>()

const emit = defineEmits<{
	(e: 'select-cards', cardIds: string[]): void
}>()

const selectedCards = ref<string[]>([])
const hoveredIndex = ref<number | null>(null)
const dragX = ref(0)
const isDragging = ref(false)
const startX = ref(0)
const {playSfx} = useSfx()
const playHoverSfx = () => playSfx('/sounds/sfx/hover.wav')
const playSelectSfx = () => playSfx('/sounds/sfx/select.wav')
const cardsToSelect = computed(() => props.cardsToSelect || 1)
const centerIndex = computed(() => Math.floor((props.cards.length - 1) / 2))

// Fan spread config
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const isMobile = computed(() => windowWidth.value < 768)

// Make fan spread config responsive to screen size
const maxRotation = computed(() => windowWidth.value < 768 ? 0.5 : 1.5)
const maxXOffset = computed(() => {
	// Smaller screens get smaller offset
	if (windowWidth.value < 480) return 20
	if (windowWidth.value < 768) return 35
	return 50
})
const maxYOffset = 2
const baseShiftAmount = 150 // Base value for shift amount
const shiftAmount = computed(() => {
	// Scale the shift amount based on window width
	// Smaller screens get smaller shift, larger screens get larger shift
	const minWidth = 320 // Mobile
	const maxWidth = 1920 // Large desktop
	const minShift = 10
	const currentWidth = Math.min(Math.max(windowWidth.value, minWidth), maxWidth)
	const ratio = (currentWidth - minWidth) / (maxWidth - minWidth)
	return minShift + (baseShiftAmount - minShift) * ratio
})

function handleHover(index: number) {
	if (isMobile.value) return // No hover on mobile
	if (hoveredIndex.value !== index) {
		hoveredIndex.value = index
		playHoverSfx()
	}
}

function handleSubmitCards() {
	emit('select-cards', selectedCards.value)
	playSfx('/sounds/sfx/submit.wav')
}

function handleCardClick(cardId: string) {
	if (props.disabled) return
	const index = selectedCards.value.indexOf(cardId)
	if (index === -1) {
		if (selectedCards.value.length < cardsToSelect.value) {
			selectedCards.value.push(cardId)
		}
	} else {
		selectedCards.value.splice(index, 1)
	}
	playSelectSfx()

	if (!isMobile.value) {
		setTimeout(() => {
			hoveredIndex.value = null
		}, 300)
	}
}

function handleTouchStart(e: TouchEvent) {
	// TODO: Implement touch start
}

function handleTouchMove(e: TouchEvent) {
	// TODO: Implement touch move
}

function handleTouchEnd(e: TouchEvent) {
	// TODO: Implement touch end
}

function handleTouchCancel(e: TouchEvent) {
	// TODO: Implement touch cancel
}

function handleCardTouchStart(e: TouchEvent, cardId: string) {
	// TODO: Implement card touch start
}

function handleCardTouchEnd(e: TouchEvent, cardId: string) {
	// TODO: Implement card touch end
}

function updateHandPositions() {
	if (!cardRefs.value.length) return

	const len = props.cards.length
	const center = (len - 1) / 2

	cardRefs.value.forEach((el, i) => {
		if (!el) return

		const offset = i - center
		// Use a tighter spread on mobile if needed, or rely on shiftAmount
		const x = offset * shiftAmount.value
		// Add some curve
		const y = Math.abs(offset) * maxYOffset * 5 
		const rotation = offset * maxRotation.value * 5

		if (setters.value[i]) {
			setters.value[i](`translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg)`)
		} else {
			gsap.set(el, {
				x,
				y,
				rotation
			})
		}
	})
}

// Handle window resize
const handleResize = () => {
	windowWidth.value = window.innerWidth
	updateHandPositions()
}

onMounted(() => {
	nextTick(() => updateHandPositions())
	setters.value = cardRefs.value.map(el =>
			gsap.quickSetter(el, 'transform') as unknown as (val: string) => void
	)

	if (typeof window !== 'undefined') {
		window.addEventListener('resize', handleResize)
	}
})

onUnmounted(() => {
	if (typeof window !== 'undefined') {
		window.removeEventListener('resize', handleResize)
	}
})
</script>

<template>
	<div class="relative w-full md:h-80 group">
		<div
				class="absolute bottom-0 w-full md:h-64 md:translate-y-[65%] md:group-hover:translate-y-0 transition-transform duration-150 linear">
			<div class="fixed bottom-0 w-full h-auto md:h-46 flex flex-col items-center overflow-visible">

				<!-- Submit button -->
				<div class="absolute bottom-full mb-4 md:bottom-78 sm:bottom-72 flex justify-center w-auto px-4 z-20">
					<UButton
							:disabled="selectedCards.length !== cardsToSelect || props.disabled"
							block
							class="md:w-full w-64 p-4 font-bold rounded-lg cursor-pointer disabled:bg-gray-500/50 disabled:text-gray-200/50 shadow-lg"
							color="primary"
							icon="i-solar-file-send-bold-duotone"
							size="xl"
							variant="solid"
							@click="handleSubmitCards"
					>
						<p class="text-lg font-['Bebas_Neue']">
							{{
								selectedCards.length < cardsToSelect
										? t('game.selected_cards', {
											count: selectedCards.length,
											total: cardsToSelect
										})
										: t('game.submit_cards')
							}}
						</p>
					</UButton>
				</div>

				<!-- Card Hand -->
				<div
						ref="handWrapper"
						class="relative md:absolute flex items-center justify-center w-full h-full"
						:class="{'overflow-x-auto pb-4 px-4 justify-start items-end gap-2': isMobile, 'touch-none': !isMobile}"
						:style="!isMobile ? 'touch-action: none;' : ''"
						@mouseenter="!isMobile && (hoveredIndex = centerIndex)"
						@mouseleave="!isMobile && (hoveredIndex = null)"
						@touchstart="handleTouchStart"
						@touchmove="handleTouchMove"
						@touchend="handleTouchEnd"
						@touchcancel="handleTouchCancel"
				>
					<div :class="isMobile ? 'flex flex-nowrap gap-2 min-w-min mx-auto' : 'absolute flex items-center justify-center w-full h-full'">
						<div
								v-for="(cardId, index) in props.cards"
								:key="cardId"
								ref="cardRefs"
								:class="[
									isMobile ? 'relative flex-shrink-0' : 'absolute mb-30 cursor-pointer touch-none'
								]"
								:style="!isMobile ? 'touch-action: none;' : ''"
								@click="handleCardClick(cardId)"
								@mouseenter="handleHover(index)"
								@mouseleave="!isMobile && (hoveredIndex = null)"
								@touchstart="(e) => handleCardTouchStart(e, cardId)"
								@touchend="(e) => handleCardTouchEnd(e, cardId)"
						>
							<div
									:class="[
                  'md:w-48 w-32 text-black rounded-xl shadow-md flex items-center justify-center text-center text-sm font-bold transition-all duration-150 linear',
                  // Different hover effects for mobile vs desktop
                  !isMobile && windowWidth >= 768 ? 'hover:scale-110 hover:-translate-y-5' : '',
                  // Selected card styling
                  selectedCards.includes(cardId)
                    ? 'outline-green-500 shadow-green-500/50 shadow-xl outline-4 scale-105 z-10'
                    : 'outline-green-500/0 shadow-none rounded-xl outline-4'
                ]"
							>
								<WhiteCard :cardId="cardId"/>
							</div>
						</div>
					</div>
				</div>

			</div>
		</div>
	</div>
</template>
