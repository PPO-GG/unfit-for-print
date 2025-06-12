<script lang="ts" setup>
import {ref, computed, watch, onMounted, onUnmounted, nextTick} from 'vue'
import {useSfx} from '@/composables/useSfx'
import {gsap} from 'gsap'

const {t} = useI18n()
const setters = ref<((val: string) => void)[]>([])

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
const cardsToSelect = computed(() => props.cardsToSelect || 1)
const centerIndex = computed(() => Math.floor((props.cards.length - 1) / 2))

// Fan spread config
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
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
	const maxShift = 150

	return Math.max(
			minShift,
			Math.min(
					maxShift,
					baseShiftAmount * (windowWidth.value / 1024) // Scale based on "standard" 1024px width
			)
	)
})

// Store refs for each card
const cardRefs = ref<HTMLElement[]>([])

// Smooth position update function
function updateHandPositions() {
	props.cards.forEach((cardId, index) => {
		const el = cardRefs.value[index]
		if (!el) return

		const shiftX = (index - centerIndex.value) * maxXOffset.value
				+ (hoveredIndex.value !== null
						? (index < hoveredIndex.value ? -shiftAmount.value
								: index > hoveredIndex.value ? shiftAmount.value
										: 0)
						: 0)

		const shiftY = Math.pow(index - centerIndex.value, 2) * maxYOffset
				+ (hoveredIndex.value === index ? -40 : 0) // Increased lift for better visibility on mobile

		const rotationDeg = (index - centerIndex.value) * maxRotation.value

		// Add scale effect for hovered card to make it more noticeable
		const scale = hoveredIndex.value === index ? 1.15 : 1

		const transform = `
		  translateX(${shiftX + dragX.value}px)
		  translateY(${shiftY}px)
		  rotate(${rotationDeg}deg)
		  scale(${scale})
		`

		gsap.to(el, {
			transform,
			duration: 0.4,
			ease: 'power3.out'
		})
	})
}

// Call update when hover, selection or drag changes
watch([hoveredIndex, selectedCards, dragX], updateHandPositions)
watch(() => props.cards.length, async () => {
	await nextTick()
	updateHandPositions()
})

function submitCards() {
	if (selectedCards.value.length === cardsToSelect.value && !props.disabled) {
		emit('select-cards', selectedCards.value)
		selectedCards.value = []
	}
}

// Mobile swipe handlers
function handleTouchStart(event: TouchEvent) {
	// Prevent default to avoid scrolling while swiping cards
	event.preventDefault()
	event.stopPropagation()
	isDragging.value = true
	startX.value = event.touches[0].clientX

	// Set hovered index to center on touch start for initial feedback
	hoveredIndex.value = centerIndex.value
}

function handleTouchMove(event: TouchEvent) {
	if (!isDragging.value) return

	// Prevent default to avoid scrolling while swiping cards
	event.preventDefault()
	event.stopPropagation()

	const currentX = event.touches[0].clientX
	const deltaX = currentX - startX.value
	dragX.value += deltaX
	startX.value = currentX

	// Clamp dragging - adjust based on screen size
	const maxDrag = windowWidth.value < 768 ? 100 : 150
	dragX.value = Math.max(-maxDrag, Math.min(maxDrag, dragX.value))

	// Determine which card should be hovered based on touch position
	// Lower threshold for movement detection to make it more responsive
	if (Math.abs(deltaX) > 2) {
		// Calculate which card should be hovered based on drag amount
		// Map the drag position to a card index
		// As drag moves right (positive), we want to highlight cards to the left (lower index)
		// As drag moves left (negative), we want to highlight cards to the right (higher index)
		const totalCards = props.cards.length
		const dragRatio = dragX.value / maxDrag // Range: -1 to 1

		// Map the drag ratio to a card offset from center
		// Multiply by half the number of cards to get full range
		const cardOffset = Math.round(-dragRatio * (totalCards / 2))

		// Calculate new hovered index, ensuring it stays within bounds
		const newIndex = Math.max(0, Math.min(totalCards - 1, 
			centerIndex.value + cardOffset))

		// Update hovered index if it changed
		if (hoveredIndex.value !== newIndex) {
			hoveredIndex.value = newIndex
			playHoverSfx()
		}
	}
}

function handleTouchEnd(event: TouchEvent) {
	if (event) {
		event.preventDefault()
		event.stopPropagation()
	}
	isDragging.value = false

	// Animate drag position back to center with a bounce effect
	gsap.to(dragX, {
		value: 0, 
		duration: 0.5, 
		ease: 'back.out(1.2)'
	})

	// Keep the hovered card in the foreground for potential selection
	// But reset it after a timeout if the user doesn't interact
	setTimeout(() => {
		// Only reset if we're not dragging again and no card has been selected
		if (!isDragging.value) {
			hoveredIndex.value = null
		}
	}, 3000) // Reset after 3 seconds of inactivity
}

function handleTouchCancel(event: TouchEvent) {
	if (event) {
		event.preventDefault()
		event.stopPropagation()
	}
	isDragging.value = false

	// Reset drag position immediately
	dragX.value = 0
	updateHandPositions()
}

// Handle card touch events
function handleCardTouchStart(event: TouchEvent, cardId: string) {
	// Prevent event from bubbling up to the wrapper
	event.preventDefault()
	event.stopPropagation()

	// Track the start position to determine if this is a tap or a drag
	startX.value = event.touches[0].clientX
}

function handleCardTouchEnd(event: TouchEvent, cardId: string) {
	// Prevent event from bubbling up to the wrapper
	event.preventDefault()
	event.stopPropagation()

	// Get the current position
	const currentX = event.changedTouches[0].clientX
	const deltaX = Math.abs(currentX - startX.value)

	// Only handle as a tap if the finger hasn't moved much (less than 10px)
	// and we're not in a dragging state
	if (deltaX < 10 && !isDragging.value) {
		// This is a tap, handle the card click
		handleCardClick(cardId)
	}
}

function playHoverSfx() {
	playSfx([
		'/sounds/sfx/hover1.wav',
		'/sounds/sfx/hover2.wav',
		'/sounds/sfx/hover3.wav',
		'/sounds/sfx/hover4.wav'
	], {volume: 0.75, pitch: [0.95, 1.05]})
}

function playSelectSfx() {
	playSfx([
		'/sounds/sfx/cardSelect1.wav',
		'/sounds/sfx/cardSelect2.wav',
		'/sounds/sfx/cardSelect3.wav',
	], {volume: 0.75, pitch: [0.95, 1.05]})
}

function handleHover(index: number) {
	if (hoveredIndex.value !== index) {
		hoveredIndex.value = index
		playHoverSfx()
	}
}

function handleSubmitCards() {
	submitCards()
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

	// Reset hoveredIndex after a card is tapped to return to normal view
	// This ensures that after selecting a card, the view returns to normal
	setTimeout(() => {
		hoveredIndex.value = null
	}, 300) // Short delay to allow the user to see the selection
}

// Handle window resize
const handleResize = () => {
	windowWidth.value = window.innerWidth
	updateHandPositions()
}

onMounted(() => {
	nextTick(() => updateHandPositions())
	setters.value = cardRefs.value.map(el =>
			gsap.quickSetter(el, 'transform')
	)

	// Add resize event listener
	if (typeof window !== 'undefined') {
		window.addEventListener('resize', handleResize)
	}
})

onUnmounted(() => {
	// Remove resize event listener
	if (typeof window !== 'undefined') {
		window.removeEventListener('resize', handleResize)
	}
})
</script>

<template>
	<div class="relative w-full md:h-80 group">
		<div
				class="absolute bottom-0 w-full md:h-64 md:translate-y-[65%] md:group-hover:translate-y-0 transition-transform duration-150 linear">
			<div class="fixed bottom-0 w-full h-46 flex flex-col items-center overflow-visible">

				<!-- Submit button -->
				<div class="absolute bottom-78 md:bottom-78 sm:bottom-72 flex justify-center w-auto px-4 z-10">
					<UButton
							:disabled="selectedCards.length !== cardsToSelect || props.disabled"
							block
							class="md:w-full w-64 p-4 font-bold rounded-lg cursor-pointer disabled:bg-gray-500/50 disabled:text-gray-200/50"
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
						class="absolute flex items-center justify-center w-full h-full touch-none"
						style="touch-action: none;"
						@mouseenter="hoveredIndex = centerIndex"
						@mouseleave="hoveredIndex = null"
						@touchstart="handleTouchStart"
						@touchmove="handleTouchMove"
						@touchend="handleTouchEnd"
						@touchcancel="handleTouchCancel"
				>
					<div class="absolute flex items-center justify-center w-full h-full">
						<div
								v-for="(cardId, index) in props.cards"
								:key="cardId"
								ref="cardRefs"
								class="absolute mb-30 cursor-pointer touch-none"
								style="touch-action: none;"
								@click="handleCardClick(cardId)"
								@mouseenter="handleHover(index)"
								@mouseleave="hoveredIndex = null"
								@touchstart="(e) => handleCardTouchStart(e, cardId)"
								@touchend="(e) => handleCardTouchEnd(e, cardId)"
						>
							<div
									:class="[
                  'md:w-48 w-28 text-black rounded-xl shadow-md flex items-center justify-center text-center text-sm font-bold transition-transform duration-150 linear',
                  // Different hover effects for mobile vs desktop
                  windowWidth.value >= 768 ? 'hover:scale-110 hover:-translate-y-5' : '',
                  // Selected card styling
                  selectedCards.includes(cardId)
                    ? 'outline-green-500 shadow-green-500/50 shadow-xl outline-4 scale-105'
                    : 'outline-green-500/0 shadow-none rounded-xl outline-4'
                ]"
							>
								<whiteCard :cardId="cardId"/>
							</div>
						</div>
					</div>
				</div>

			</div>
		</div>
	</div>
</template>
