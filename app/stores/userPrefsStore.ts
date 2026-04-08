// stores/userPrefsStore.ts
import { defineStore } from 'pinia'
import { DEFAULT_TTS_VOICE } from '~/constants/ttsProviders'

export const useUserPrefsStore = defineStore('userPrefs', {
    state: () => ({
        ttsEnabled: false,
        theme: 'system' as 'light' | 'dark' | 'system',
        chatProfanityFilter: true,
        preferredLanguage: 'en',
        ttsVoice: DEFAULT_TTS_VOICE.id,

        acceptedWarning: false,

        /** Global UI zoom level (75-150, percentage) */
        uiScale: 100,
    }),

    actions: {
        toggleTTS() {
            this.ttsEnabled = !this.ttsEnabled
        },
        setTheme(theme: 'light' | 'dark' | 'system') {
            this.theme = theme
        },
        setLanguage(lang: string) {
            this.preferredLanguage = lang
        },
        toggleProfanityFilter() {
            this.chatProfanityFilter = !this.chatProfanityFilter
        },
        setAcceptedWarning(value: boolean) {
            this.acceptedWarning = value
        },
        setUiScale(scale: number) {
            this.uiScale = Math.min(150, Math.max(75, scale))
        }
    },

    persist: {
        serializer: {
            serialize: JSON.stringify,
            deserialize: JSON.parse,
        }
    }
})
