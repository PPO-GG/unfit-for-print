<script setup lang="ts">
import { useUserPrefsStore } from '@/stores/userPrefsStore';
import {ref} from "vue";
import {useBrowserSpeech} from "~/composables/useBrowserSpeech";
import type {DropdownMenuItem} from "@nuxt/ui";

const userPrefs = useUserPrefsStore()
const voices = ref<SpeechSynthesisVoice[]>([])
const { getVoices, isVoiceAvailable } = useBrowserSpeech()

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

const updateVoice = () => {
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
	} else {
		// Otherwise, just make sure the selected voice is available
		updateVoice()
	}
}

const currentVoice = computed(() => 
	voices.value.find(voice => voice.name === userPrefs.ttsVoice) || voices.value[0] || null
)

const items = computed<DropdownMenuItem[]>(() =>
		[...voices.value]
			.sort((a, b) => a.name.localeCompare(b.name))
			.map(voice => {
				const isSelected = voice.name === userPrefs.ttsVoice;
				return {
					label: voice.name,
					color: isSelected ? 'primary' : undefined,
					icon: isSelected ? 'i-heroicons-speaker-wave' : undefined,
					trailing: isSelected ? { icon: 'i-heroicons-check', color: 'green' } : undefined,
					onSelect: () => userPrefs.ttsVoice = voice.name
				};
			})
)

onMounted(() => {
	if (import.meta.client) {
		if (speechSynthesis.onvoiceschanged !== undefined) {
			speechSynthesis.onvoiceschanged = loadVoices
		}
		setTimeout(loadVoices, 500)
	}
});
</script>

<template>
	<UDropdownMenu
			:items="items"
			:content="{
      align: 'start',
      side: 'bottom',
      sideOffset: 8
    }"
			:ui="{
      content: 'w-48 max-h-60 overflow-y-auto'
    }"
	>
		<UButton
				color="neutral"
				variant="ghost"
				class="flex items-center gap-2 text-xs"
				icon="i-solar-user-speak-bold-duotone"
		>
			<span>TTS Voice</span>
		</UButton>
	</UDropdownMenu>
</template>

<style scoped>

</style>
