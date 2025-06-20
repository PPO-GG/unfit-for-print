// stores/userPrefsStore.ts
import { defineStore } from 'pinia'

export const useUserPrefsStore = defineStore('userPrefs', {
    state: () => ({
        ttsEnabled: false,
        theme: 'system' as 'light' | 'dark' | 'system',
        chatProfanityFilter: true,
        preferredLanguage: 'en',
        ttsVoice: '',
        acceptedWarning: false,
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
        }
    },

    persist: {
        serializer: {
            serialize: JSON.stringify,
            deserialize: JSON.parse,
        }
    }
})
