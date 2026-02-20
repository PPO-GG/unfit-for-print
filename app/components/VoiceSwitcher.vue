<script lang="ts" setup>
import {useUserPrefsStore} from '@/stores/userPrefsStore';
import {ref} from "vue";
import {useBrowserSpeech} from "~/composables/useBrowserSpeech";
import {useIsAdmin} from "~/composables/useAdminCheck";
import {TTS_PROVIDERS} from "~/constants/ttsProviders";

const userPrefs = useUserPrefsStore()
const voices = ref<SpeechSynthesisVoice[]>([])
const {getVoices, isVoiceAvailable} = useBrowserSpeech()
const isAdmin = useIsAdmin()

// Get provider configurations
const elevenLabsConfig = TTS_PROVIDERS.ELEVENLABS;
const openAIConfig = TTS_PROVIDERS.OPENAI;

const findBestMatchingVoice = (): SpeechSynthesisVoice | null => {
	// Get the user's preferred language from the store
	const preferredLang = userPrefs.preferredLanguage.toLowerCase()

	// Try to find a voice that exactly matches the preferred language
	let bestMatch = voices.value.find(voice =>
			voice.lang.toLowerCase().startsWith(preferredLang)
	)

	// If no exact match, try to find a voice that starts with the same language code
	if (!bestMatch) {
		bestMatch = voices.value.find(voice =>
				voice.lang.toLowerCase().split('-')[0] === preferredLang
		)
	}

	// If still no match, return the first voice or null
	return bestMatch || voices.value[0] || null
}

const isAIVoiceAvailable = (voiceId: string): boolean => {
	// Check if the voice is an AI voice (ElevenLabs or OpenAI) and the user is an admin
	return (voiceId === elevenLabsConfig.id || voiceId === openAIConfig.id) && isAdmin.value;
}

const updateVoice = () => {
	// If the current voice is an AI voice (ElevenLabs or OpenAI) and user is admin, keep it
	if (isAIVoiceAvailable(userPrefs.ttsVoice)) {
		return;
	}

	// Otherwise check if the browser voice is available
	if (!isVoiceAvailable(userPrefs.ttsVoice)) {
		// If no voice is selected or the selected voice is not available,
		// try to find a voice that matches the user's preferred language
		const bestMatch = findBestMatchingVoice()
		userPrefs.ttsVoice = bestMatch?.name || voices.value[0]?.name || ''
	}
}

const loadVoices = () => {
	voices.value = getVoices()

	// If this is the first load or no voice is selected, try to find a voice
	// that matches the user's preferred language
	if (!userPrefs.ttsVoice) {
		const bestMatch = findBestMatchingVoice()
		userPrefs.ttsVoice = bestMatch?.name || voices.value[0]?.name || ''
	} else if (userPrefs.ttsVoice === elevenLabsConfig.id || userPrefs.ttsVoice === openAIConfig.id) {
		// If an AI voice is selected but user is not admin, reset to browser voice
		if (!isAdmin.value) {
			const bestMatch = findBestMatchingVoice()
			userPrefs.ttsVoice = bestMatch?.name || voices.value[0]?.name || ''
		}
	} else {
		// Otherwise, just make sure the selected voice is available
		updateVoice()
	}
}

const currentVoice = computed(() => {
	// If the selected voice is ElevenLabs and user is admin, return a special object
	if (userPrefs.ttsVoice === elevenLabsConfig.id && isAdmin.value) {
		return {
			name: elevenLabsConfig.displayName,
			// Add other properties that might be needed
		} as any;
	}

	// If the selected voice is OpenAI and user is admin, return a special object
	if (userPrefs.ttsVoice === openAIConfig.id && isAdmin.value) {
		return {
			name: openAIConfig.displayName,
			// Add other properties that might be needed
		} as any;
	}

	// Otherwise, find the voice in the browser voices
	return voices.value.find(voice => voice.name === userPrefs.ttsVoice) || voices.value[0] || null;
})

const items = computed<DropdownMenuItem[]>(() => {
	// Start with browser voices
	const browserVoices = [...voices.value]
			.sort((a, b) => a.name.localeCompare(b.name))
			.map(voice => {
				const isSelected = voice.name === userPrefs.ttsVoice;
				return {
					label: voice.name,
					color: isSelected ? 'primary' : undefined,
					icon: isSelected ? 'i-solar-user-speak-bold-duotone' : undefined,
					onSelect: () => userPrefs.ttsVoice = voice.name
				};
			});

	// Add AI voice options for admins
	if (isAdmin.value) {
		// Add OpenAI voice option
		const isOpenAISelected = userPrefs.ttsVoice === openAIConfig.id;
		browserVoices.unshift({
			label: openAIConfig.displayName,
			color: isOpenAISelected ? 'primary' : undefined,
			icon: 'i-solar-magic-stick-3-bold-duotone',
			onSelect: () => userPrefs.ttsVoice = openAIConfig.id
		});

		// Add ElevenLabs voice option
		const isElevenLabsSelected = userPrefs.ttsVoice === elevenLabsConfig.id;
		browserVoices.unshift({
			label: elevenLabsConfig.displayName,
			color: isElevenLabsSelected ? 'primary' : undefined,
			icon: 'i-solar-magic-stick-3-bold-duotone',
			onSelect: () => userPrefs.ttsVoice = elevenLabsConfig.id
		});
	}

	return browserVoices;
})

onMounted(() => {
	if (typeof window !== 'undefined') {
		if (speechSynthesis.onvoiceschanged !== undefined) {
			speechSynthesis.onvoiceschanged = loadVoices
		}
		setTimeout(loadVoices, 500)
	}
});
</script>

<template>
	<ClientOnly>
		<UDropdownMenu
				:content="{
      align: 'start',
      side: 'bottom',
      sideOffset: 8
    }"
				:items="items"
				:ui="{
      content: 'w-48 max-h-60 overflow-y-auto'
    }"
		>
			<UButton
					class="flex items-center gap-2 text-xs"
					color="neutral"
					icon="i-solar-user-speak-bold-duotone"
					variant="ghost"
			>
				<span>TTS Voice</span>
			</UButton>
		</UDropdownMenu>
	</ClientOnly>
</template>

<style scoped>

</style>
