<template>
	<div
			class="select-none perspective-distant justify-center flex items-center w-40 md:w-56 lg:w-60 xl:w-68 2xl:w-72 aspect-[3/4] hover:z-[100]">
		<div
				ref="card"
				:class="{ 'card--flipped': flipped }"
				class="card cursor-pointer"
				@mouseleave="resetTransform"
				@mousemove="handleMouseMove"
				@click="$emit('click')"
		>
			<div class="card__inner cursor-pointer">
				<!-- Front Side -->
				<div class="card__face card__front cursor-pointer">
					<slot name="front">
						<div class="card-content rounded-lg relative overflow-hidden cursor-pointer">
							<p ref="textElement" :style="textStyle" class="p-3 md:p-4 text-pretty cursor-pointer"
							   v-html="formattedCardText"
							>
							</p>
							<div
									class="absolute bottom-0 left-0 m-3 text-xl opacity-10 hover:opacity-50 transition-opacity duration-500">
								<UPopover :ui="{
									content:'w-full backdrop-blur-sm bg-slate-900/50 rounded-lg',
								}" arrow>
							    <span class="flex" @click.stop>
							      <Icon class="z-10 cursor-pointer" name="mdi:cards"/>
							    </span>
									<template #content class="">
										<div class="flex-1 p-4 font-[Bebas_Neue]">
											<p class="text-md p-1"><span class="text-yellow-500">Card ID: </span>{{ (cardId ?? '') }}</p>
											<p class="text-md p-1"><span class="text-yellow-500">Card Pack: </span>{{ cardPack }}</p>
											<UButton
													class="mt-2"
													color="warning"
													label="Report This Card"
													variant="subtle"
													@click.stop="showReportModal = true"
											/>
										</div>
									</template>
								</UPopover>
							</div>
						</div>
						<span
								class="hidden md:flex items-center absolute bottom-0 right-0 m-2 p-1 text-lg bg-slate-900/50 rounded-lg text-slate-400 font-[Bebas_Neue]">
                <Icon class="align-middle" name="mdi:cards"/>
	              {{ computedNumPick }}
              </span>
					</slot>
				</div>

				<!-- Back Side -->
				<div class="card__face card__back cursor-pointer">
					<slot name="back">
						<div class="card-content cursor-pointer">
							<img
									:src="backLogoUrl"
									alt="Card Back Logo"
									class="w-3/4 max-w-[10rem] object-contain invert opacity-75 cursor-pointer"
									draggable="false"
							/>
						</div>
					</slot>
					<div v-if="shine" :style="shineStyle" class="card__shine"></div>
				</div>
			</div>
		</div>
	</div>

	<!-- Report Card Modal -->
	<UModal v-model:open="showReportModal" :overlay="false" :title="'Report A Card'" aria-describedby="Report A Card" :description="'Please select a reason for reporting this card:'">
		<template #body>
			<ReportCard
					:card-id="cardId || ''"
					card-type="black"
					@cancel="showReportModal = false"
					@submit="showReportModal = false"
			/>
		</template>
	</UModal>
</template>

<script lang="ts" setup>
import {gsap} from "gsap";
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {debounce} from 'lodash-es';
import ReportCard from '~/components/ReportCard.vue';

// Define emits to fix the warning about extraneous non-emits event listeners
defineEmits(['click']);

const {getRandomInRange} = useCrypto()
const {playSfx} = useSfx();
const {vibrate} = useVibrate({pattern: [getRandomInRange([1, 3]), 2, getRandomInRange([1, 3])]})
const {isMobile} = useDevice();

function playRandomFlip() {
	vibrate()
	playSfx([
		'/sounds/sfx/flip1.wav',
		'/sounds/sfx/flip2.wav',
		'/sounds/sfx/flip3.wav',
	], {volume: 0.75, pitch: [0.95, 1.05]})
}

const props = defineProps<{
	cardId?: string
	text?: string
	cardPack?: string
	numPick?: number
	flipped?: boolean
	threeDeffect?: boolean
	shine?: boolean
	backLogoUrl?: string
	maskUrl?: string
}>();

const fallbackNumPick = ref<number | undefined>(undefined);

const computedNumPick = computed(() => {
	// 1. Prioritize the explicitly passed prop
	if (props.numPick !== undefined) {
		return props.numPick;
	}
	// 2. Use the value fetched via cardId if the prop wasn't passed
	if (fallbackNumPick.value !== undefined) {
		return fallbackNumPick.value;
	}
	// 3. Default to 1 if neither prop nor fetched value is available
	return 1;
	// Note: The underscore counting logic is removed as we prioritize the database value.
});

const fallbackText = ref('');

const cardText = computed(() => props.text || fallbackText.value);

const formattedCardText = computed(() => {
	return cardText.value.replace(/_/g, '<span class="inline-block relative w-1/2 py-1 md:py-2 h-4 lg:h-8 align-middle bg-slate-600/50 rounded-sm md:rounded-lg outline-dashed outline-1 outline-white/25 inset-shadow-xs inset-shadow-black/50 border-b-1 border-white/25 mx-1"></span>');
});

const cardPack = ref(props.cardPack || null);

// Watch for changes to the cardPack prop and update the ref
watch(() => props.cardPack, (newCardPack) => {
	cardPack.value = newCardPack || null;
});

const card = ref<HTMLElement | null>(null);
const textSize = ref(1); // Default size multiplier
const rotation = ref({x: 0, y: 0});
const shineOffset = ref({x: 0, y: 0});
const showReportModal = ref(false);

const textStyle = computed(() => {
	return {
		fontSize: `${textSize.value}rem`,
		lineHeight: `${Math.max(1, textSize.value * 1.1)}rem`,
		padding: `${textSize.value * 0.5}rem`
	};
});

function calculateTextSize() {
	if (!card.value) return;

	const width = card.value.offsetWidth;
	textSize.value = Math.max(0.2, width / 125);
}

function animateShine() {
	const ease = 0.05;
	shineOffset.value.x += (rotation.value.x - shineOffset.value.x) * ease;
	shineOffset.value.y += (rotation.value.y - shineOffset.value.y) * ease;
	requestAnimationFrame(animateShine);
}

const shineStyle = computed(() => {
	const angle = (-shineOffset.value.y + shineOffset.value.x) * 2 + 45;
	const offsetX = -shineOffset.value.y + 50;
	const offsetY = -shineOffset.value.x + 50;
	return {
		background: `
      linear-gradient(
        ${angle}deg,
        transparent,
        red,
        transparent,
        orange,
        transparent,
        yellow,
        transparent,
        green,
        transparent,
        cyan,
        transparent,
        blue,
        transparent,
        violet,
        transparent,
        red
      )
    `,
		backgroundPosition: `${offsetX}% ${offsetY}%`,
		backgroundSize: "500% 500%",
		mixBlendMode: "screen" as "screen",
		WebkitMaskImage: `url(${props.maskUrl})`,
		maskImage: `url(${props.maskUrl})`,
		WebkitMaskRepeat: "no-repeat",
		maskRepeat: "no-repeat",
		WebkitMaskSize: "cover",
		maskSize: "cover",
		WebkitMaskPosition: "center",
		maskPosition: "center",
		opacity: 0.125,
		transition: "background-position 250ms linear, background 250ms linear",
	};
});

function handleMouseMove(e: MouseEvent) {
	if (!card.value) return;
	if (isMobile) return;

	const cardRect = card.value.getBoundingClientRect();
	const x = e.clientX - cardRect.left;
	const y = e.clientY - cardRect.top;
	const centerX = cardRect.width / 2;
	const centerY = cardRect.height / 2;

	const rotateX = ((y - centerY) / centerY) * 15;
	const rotateY = ((centerX - x) / centerX) * 15;

	rotation.value = {x: rotateX, y: rotateY};

	applyTransform(rotateX, rotateY);
}

function applyTransform(rotateX = 0, rotateY = 0) {
	if (!card.value) return;
	const intensity = props.threeDeffect ? 1 : 0.3;

	// Only tilt the outer .card container
	card.value.style.transform = `
    rotateX(${rotateX * intensity}deg)
    rotateY(${rotateY * intensity}deg)
  `;
}

function resetTransform() {
	if (card.value) {
		rotation.value = {x: 0, y: 0};
		applyTransform(0, 0);
	}
}

// Watch for card content changes
watch(() => cardText.value, () => {
	nextTick(calculateTextSize);
});

watch(() => card.value?.offsetWidth, () => {
	calculateTextSize();
});


watch(() => props.flipped, (flipped) => {
	const el = card.value?.querySelector('.card__inner')
	if (!el) return;

	gsap.to(el, {
		rotateY: flipped ? 180 : 0,
		duration: 1.5,
		ease: 'elastic.out(0.2,0.1)',
		onStart: () => playRandomFlip(),
	});
});

onMounted(async () => {
	// Fetch card data only if text AND numPick are not provided, but cardId is.
	if ((!props.text || props.numPick === undefined) && props.cardId) {
		const {databases} = useAppwrite();
		const config = useRuntimeConfig();
		if (!databases) {
			console.error("Appwrite database service not available.");
			return;
		}
		try {
			console.log(`Fetching full card data for ID: ${props.cardId}`);
			const doc = await databases.getDocument(
					config.public.appwriteDatabaseId,
					config.public.appwriteBlackCardCollectionId,
					props.cardId
			);
			if (!props.text) {
				fallbackText.value = doc.text;
			}
			if (!props.cardId) {
				fallbackText.value = "CARD TEXT HERE";
				return;
			}
			if (props.numPick === undefined) {
				fallbackNumPick.value = doc.pick; // Store the fetched pick value
			}
			cardPack.value = doc.pack || null;
		} catch (error) {
			console.error(`Failed to fetch card data for ID ${props.cardId}:`, error);
			// Set sensible defaults on error if needed
			if (!props.text) fallbackText.value = 'Error loading text.';
			if (props.numPick === undefined) fallbackNumPick.value = 1;
		}
	}

	calculateTextSize();
	window.addEventListener('resize', calculateTextSize);

	resetTransform();
	animateShine();

	onBeforeUnmount(() => {
		window.removeEventListener('resize', calculateTextSize);
	});
});

</script>

<style scoped>
.card {
	width: 100%;
	height: 100%;
	background: transparent;
	border-radius: 12px;
	box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
	transform-style: preserve-3d;
	position: relative;
	transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	will-change: transform;
}

.card:hover {
	box-shadow: 0 16px 32px rgba(0, 0, 0, 0.2);
}

.card--flipped {
	transform: rotateY(180deg);
}

.card__inner {
	width: 100%;
	height: 100%;
	position: relative;
	transform-style: preserve-3d;
	border-radius: 12px;
}

.card__face {
	position: absolute;
	width: 100%;
	height: 100%;
	backface-visibility: hidden;
	-webkit-backface-visibility: hidden;
	display: flex;
	justify-content: center;
	align-items: center;
	font-family: "Bebas Neue", sans-serif;
	font-size: 1.25rem;
	text-align: center;
	border-radius: 12px;
	overflow: hidden;
	transform-style: preserve-3d;
	/* Ensure content is positioned correctly */
	z-index: 1;
	outline: 1px solid transparent;
}

.card__face::before {
	content: "";
	position: absolute;
	inset: 0;
	mix-blend-mode: overlay;
	border: 6px solid rgba(255, 255, 255, 0.5);
	pointer-events: none;
	z-index: 10;
	border-radius: 12px;
	-webkit-box-shadow: inset 0 0 100px 0 rgba(0, 0, 0, 0.25);
	-moz-box-shadow: inset 0 0 100px 0 rgba(0, 0, 0, 0.25);
	box-shadow: inset 0 0 100px 0 rgba(0, 0, 0, 0.25);
}

.card__front,
.card__back {
	position: absolute;
	width: 100%;
	height: 100%;
	top: 0;
	left: 0;
	backface-visibility: hidden;
	-webkit-backface-visibility: hidden;
	transform-style: preserve-3d;
	border-radius: 12px;
}

.card__front {
	background-color: #1c2342;
}

.card__back {
	background-color: #1c2342;
	transform: rotateY(180deg);
}

/* Ensure shine effect is properly positioned on both sides */
.card__front .card__shine,
.card__back .card__shine {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	border-radius: 12px;
	opacity: 0.25;
}

/* We'll use backface-visibility instead of display:none to allow 3D effects */
.card__front {
	backface-visibility: hidden;
	-webkit-backface-visibility: hidden;
}

.card__back {
	backface-visibility: hidden;
	-webkit-backface-visibility: hidden;
	transform: rotateY(180deg);
}

.card__shine {
	position: absolute;
	inset: 0;
	pointer-events: none;
	z-index: 100; /* Higher z-index to ensure it's on top */
	border-radius: 12px;
}

.card-content {
	position: relative;
	width: 100%;
	height: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	/* Ensure content is above the texture */
	z-index: 1;
	color: white;
	border-radius: 12px;
}
</style>
