<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useSfx } from '@/composables/useSfx'

const { t } = useI18n()
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
const {playSfx} = useSfx();
const cardsToSelect = computed(() => props.cardsToSelect || 1)
const centerIndex = computed(() => Math.floor((props.cards.length - 1) / 2))

// Fan spread config
const maxRotation = 1
const maxXOffset = 80
const maxYOffset = 2
const shiftAmount = 125


function submitCards() {
	if (selectedCards.value.length === cardsToSelect.value && !props.disabled) {
		emit('select-cards', selectedCards.value)
		selectedCards.value = []
	}
}

// Mobile swipe handlers
function handleTouchStart(event: TouchEvent) {
	isDragging.value = true
	startX.value = event.touches[0].clientX
}

function handleTouchMove(event: TouchEvent) {
	if (!isDragging.value) return
	const currentX = event.touches[0].clientX
	dragX.value += currentX - startX.value
	startX.value = currentX

	// Optional: Clamp dragging
	const maxDrag = 150
	dragX.value = Math.max(-maxDrag, Math.min(maxDrag, dragX.value))
}

function handleTouchEnd() {
	isDragging.value = false
	// Snap back to center when releasing
	dragX.value = 0
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
		hoveredIndex.value = index;
		playHoverSfx();
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
}
</script>

<template>
	<div class="relative w-full md:h-80 group">
		<div class="absolute bottom-0 w-full md:h-64 md:translate-y-[65%] group-hover:translate-y-0 transition-transform duration-150 linear">
			<div class="fixed bottom-0 w-full h-46 flex flex-col items-center overflow-visible">
				<div class="absolute bottom-78 flex justify-center w-auto px-4">
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
						class="absolute bottom-0 h-full w-3/12 flex justify-center"
						@touchend="handleTouchEnd"
						@touchstart.passive="handleTouchStart"
						@touchmove.passive="handleTouchMove"
				>
					<div
							:style="{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? 'none' : 'transform 250ms linear'
        }"
							class="absolute flex items-center justify-center w-full h-full"
					>
						<div
								v-for="(cardId, index) in props.cards"
								:key="cardId"
								:style="{
            transform: `
              translateX(${(index - centerIndex) * maxXOffset
                      + (hoveredIndex !== null
                        ? (index < hoveredIndex ? -shiftAmount
                          : index > hoveredIndex ? shiftAmount
                          : 0)
                        : 0)}px)
              translateY(${Math.pow(index - centerIndex, 2) * maxYOffset
                      + (hoveredIndex === index ? -10 : 0)}px)
              rotate(${(index - centerIndex) * maxRotation}deg)
            `,
            zIndex: props.cards.length - index
          }"
								class="absolute mb-30 transition-all duration-150 linear cursor-pointer"
								@click="handleCardClick(cardId)"
								@mouseenter="handleHover(index)"
								@mouseleave="hoveredIndex = null"
						>
							<div
									:class="[
              'md:w-48 w-32 text-black rounded-xl shadow-md flex items-center justify-center text-center text-sm font-bold hover:scale-110 hover:-translate-y-5 transition-transform duration-150 linear',
              selectedCards.includes(cardId)
                ? 'outline-green-500 shadow-green-500/50 shadow-xl outline-4'
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
