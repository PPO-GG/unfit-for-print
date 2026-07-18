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

        /** Music volume (0-100) + mute flag — BrandSettingsDrawer. */
        musicVol: 60,
        musicMuted: false,
        /** Sound-effects volume (0-100) + mute flag — BrandSettingsDrawer. */
        sfxVol: 80,
        sfxMuted: false,
        /** Accessibility: disable card flips, confetti, parallax. */
        reduceMotion: false,
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
        },
        setMusicVol(vol: number) {
            this.musicVol = Math.min(100, Math.max(0, vol))
        },
        setSfxVol(vol: number) {
            this.sfxVol = Math.min(100, Math.max(0, vol))
        },
        setMusicMuted(muted: boolean) { this.musicMuted = muted },
        setSfxMuted(muted: boolean) { this.sfxMuted = muted },
        setReduceMotion(value: boolean) { this.reduceMotion = value },
    },

    persist: {
        serializer: {
            serialize: JSON.stringify,
            deserialize: JSON.parse,
        }
    }
})
