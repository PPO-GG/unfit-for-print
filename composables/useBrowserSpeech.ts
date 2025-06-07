// composables/useBrowserSpeech.ts
import { useUserPrefsStore } from '@/stores/userPrefsStore';
import { ref } from 'vue';

export function useBrowserSpeech() {
    const userPrefs = useUserPrefsStore()
    const isSpeaking = ref(false);

    const speak = (text: string, voiceOverride?: string, rate = 1) => {
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = speechSynthesis.getVoices();

        const selectedVoiceName = voiceOverride || userPrefs.ttsVoice || ''
        const selectedVoice = voices.find(v => v.name === selectedVoiceName)
        if (selectedVoice) utterance.voice = selectedVoice;

        utterance.rate = rate;

        // Set speaking state to true when speech starts
        isSpeaking.value = true;

        // Add event listeners to track when speech ends
        utterance.onend = () => {
            isSpeaking.value = false;
        };

        utterance.onerror = () => {
            isSpeaking.value = false;
        };

        speechSynthesis.speak(utterance);
    };

    const getVoices = (): SpeechSynthesisVoice[] => {
        return speechSynthesis.getVoices();
    };

    const isVoiceAvailable = (voiceName: string): boolean => {
        return getVoices().some(v => v.name === voiceName)
    }

    return { speak, getVoices, isVoiceAvailable, isSpeaking }
}
