<template>
	<div class="flex flex-col items-center justify-center">
		<LoadingOverlay :is-loading="isLoading" />
		<UAlert
				v-if="!userPrefs.acceptedWarning"
				color="warning"
				variant="solid"
				title="Heads up!"
				description="This Game is still in development and may contain bugs or incomplete features."
				icon="i-solar-shield-warning-bold-duotone"
				:ui="{
		      icon: 'size-11 my-auto',
		      title: 'text-xl font-bold',
		      description: 'text-lg',
		    }"
				class="w-full max-w-5xl text-5xl font-['Bebas_Neue'] text-center"
				close
				:open="!userPrefs.acceptedWarning"
				@update:open="(isOpen) => !isOpen && userPrefs.setAcceptedWarning(true)"
		/>
		<div class="px-4 py-8 flex flex-col items-center text-center select-none pointer-events-none">
			<img src="/img/ufp2.svg" alt="Unfit For Print Logo" class="mx-auto w-32 md:w-64 h-auto drop-shadow-xl drop-shadow-black/25" />
		</div>
		<div class="flex justify-center gap-6">
			<div class="outline-2 outline-dashed dark:outline-slate-300/25 outline-slate-900/25 outline-offset-4 rounded-xl">
				<BlackCard
						v-if="blackCard"
						:back-logo-url="'/img/ufp.svg'"
						:card-id="blackCard.$id"
						:cardPack=blackCard.pack
						:flipped="blackCardFlipped"
						:mask-url="'/img/textures/hexa.webp'"
						:num-pick="randomCard.pick"
						:shine="shine"
						:text="blackCard.text"
						:threeDeffect="threeDeffect"
						@click="blackCardFlipped = !blackCardFlipped"
				/>
				<div v-else
				     class="flex items-center p-2 text-white mt-4 w-40 md:w-56 lg:w-60 xl:w-68 2xl:w-72 aspect-[3/4] bg-[#1c2342] rounded-xl border-6 border-slate-800">
					<div class="grid gap-2">
						<USkeleton class="h-4 w-30 md:w-44 lg:w-48 xl:w-56 2xl:w-60 bg-slate-600/50"/>
						<USkeleton class="h-4 w-26 md:w-40 lg:w-44 xl:w-52 2xl:w-56 bg-slate-600/50"/>
					</div>
				</div>
			</div>

			<div class="outline-2 outline-dashed dark:outline-slate-300/25 outline-slate-900/25 outline-offset-4 rounded-xl">
				<WhiteCard
						v-if="whiteCard"
						:back-logo-url="'/img/ufp.svg'"
						:card-id="whiteCard.$id"
						:card-pack="whiteCard.pack"
						:flipped="whiteCardFlipped"
						:mask-url="'/img/textures/hexa2.webp'"
						:shine="shine"
						:text="whiteCard.text"
						:three-deffect="threeDeffect"
						@click="whiteCardFlipped = !whiteCardFlipped"
				/>
				<div v-else
				     class="flex items-center p-2 text-white mt-4 w-40 md:w-56 lg:w-60 xl:w-68 2xl:w-72 aspect-[3/4] bg-[#e7e1de] rounded-xl border-6 border-stone-400/50">
					<div class="grid gap-2">
						<USkeleton class="h-4 w-30 md:w-44 lg:w-48 xl:w-56 2xl:w-60 bg-stone-400/50"/>
						<USkeleton class="h-4 w-26 md:w-40 lg:w-44 xl:w-52 2xl:w-56 bg-stone-400/50"/>
					</div>
				</div>
			</div>
		</div>
		<div class="flex flex-col items-center mt-8">
			<ClientOnly>
				<UButtonGroup>
					<UButton
							:loading="isFetching"
							class="text-xl py-2 px-4 cursor-pointer font-['Bebas_Neue']"
							color="secondary" icon="i-solar-layers-minimalistic-bold-duotone" variant="subtle"
							@click="handleTryMeClick"
					>
						{{ t('try_me') }}
					</UButton>
					<UButton
							:disabled="isSpeaking"
							:loading="isSpeaking"
							class="text-xl py-2 px-4 cursor-pointer font-['Bebas_Neue']"
							color="primary" icon="i-solar-user-speak-bold-duotone" variant="subtle"
							@click="handleSpeakClick"
					/>
				</UButtonGroup>
			</ClientOnly>
		</div>
	</div>

</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useCards } from '~/composables/useCards';
import { useVibrate } from '@vueuse/core';
import { useBrowserSpeech } from '~/composables/useBrowserSpeech';
import { useSpeech } from '~/composables/useSpeech';
import { mergeCardText } from '~/composables/useMergeCards';
import { useI18n } from 'vue-i18n';
import { useUserPrefsStore } from '@/stores/userPrefsStore';

// Loading state
const isLoading = ref(true);

const { t } = useI18n();
const userPrefs = useUserPrefsStore();

// ElevenLabs voice ID
const elevenLabsVoiceId = 'NuIlfu52nTXRM2NXDrjS';

// Initialize speech functions only on client side
let browserSpeech = {
	speak: (text: string, voiceOverride?: string, rate?: number) => {
		console.log(`Speaking with browser speech: ${text}`);
	},
	isSpeaking: ref(false)
};
let elevenLabsSpeech = {
	speak: (text: string) => {
		console.log(`Speaking with ElevenLabs speech: ${text}`);
	},
	isSpeaking: ref(false)
};

if (typeof window !== 'undefined') {
	browserSpeech = useBrowserSpeech();
	elevenLabsSpeech = useSpeech(elevenLabsVoiceId);
}

// Computed to determine if we're on the client side
const isClient = computed(() => {
	return typeof window !== 'undefined';
});

// Computed to determine which speech function to use
const isSpeaking = computed(() => {
	if (!isClient.value) return false;

	return userPrefs.ttsVoice === elevenLabsVoiceId
			? elevenLabsSpeech.isSpeaking.value
			: browserSpeech.isSpeaking.value;
});

// Function to speak text using the appropriate speech function
const speak = (text: string) => {
	if (!isClient.value || !text) return;

	if (userPrefs.ttsVoice === elevenLabsVoiceId) {
		elevenLabsSpeech.speak(text);
	} else {
		browserSpeech.speak(text, undefined, 1.0); // Example with default rate
	}
};

// Safe wrapper for the Try Me button click handler
const handleTryMeClick = () => {
	fetchNewCards();

	if (isClient.value) {
		umTrackEvent('fetch-new-cards-index');
	}
};

// Safe wrapper for the speak button click handler
const handleSpeakClick = () => {
	if (!blackCard.value || !whiteCard.value) return;
	const mergedText = mergeCardText(blackCard.value.text, whiteCard.value.text);
	if (!mergedText) return;
	speak(mergedText);
};

const { vibrate } = useVibrate({ pattern: [10, 7, 5] });
useHead({
	title: `Unfit for Print`,
});

const whiteCard = ref<any>(null);
const blackCard = ref<any>(null);
const blackCardFlipped = ref(true);
const whiteCardFlipped = ref(true);
const threeDeffect = ref(true);
const shine = ref(true);
const { fetchRandomCard } = useCards();
const randomCard = ref<any>({ pick: 1 });
const { playSfx } = useSfx();
const { notify } = useNotifications();

const isFetching = ref(false);

const fetchNewCards = async () => {
	if (isFetching.value) return;
	isFetching.value = true;

	whiteCardFlipped.value = true;
	blackCardFlipped.value = true;

	if (isClient.value) {
		await playSfx('/sounds/sfx/submit.wav', { pitch: [0.8, 1.2], volume: 0.75 });
	}

	setTimeout(() => {
		if (isClient.value) {
			vibrate();
		}

		fetchRandomCard('black', 1).then((card: any) => {
			blackCard.value = card;
			randomCard.value = card;
			blackCardFlipped.value = false;

			return fetchRandomCard('white');
		}).then((card: any) => {
			whiteCard.value = card;
			whiteCardFlipped.value = false;
		});

		setTimeout(() => {
			isFetching.value = false;
		}, 1250);
	});
};

onMounted(() => {
	fetchNewCards();

	// Hide loading overlay after a short delay
	setTimeout(() => {
		isLoading.value = false;
	}, 500);
});
</script>
