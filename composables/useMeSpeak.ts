// composables/useMeSpeak.ts
import type { SpeakOptions } from 'mespeak'
import config from 'mespeak/src/mespeak_config.json'
import defaultVoice from 'mespeak/voices/en/en.json'

let initialized = false
let meSpeak: typeof import('mespeak') | null = null

/**
 * Generates voice parameters based on a user ID
 */
export function uidToVoiceParams(uid: string): Partial<SpeakOptions> {
    let hash = 0
    for (let i = 0; i < uid.length; i++) {
        hash = uid.charCodeAt(i) + ((hash << 5) - hash)
    }
    hash = Math.abs(hash >>> 0)

    // 🎯 Wider and more extreme ranges
    const pitch = Math.min(150, 10 + (hash % 121))           // 20–80, capped at 99
    const speed = Math.min(150, 25+ (hash >> 3 % 121))   // 100–220, capped at 450
    const wordgap = 1
    const amplitude = Math.min(200, 80 + (hash >> 7 % 41)) // 80–120

    return {
        pitch,
        speed,
        wordgap,
        amplitude,
        volume: 1,
    }
}

export async function useMeSpeak() {
    const init = async (voice: any = defaultVoice) => {
        if (!import.meta.client || initialized) return

        meSpeak = await import('mespeak')
        meSpeak.loadConfig(config)

        // Clone voice JSON to avoid "Can't overwrite object" error
        const safeVoice = JSON.parse(JSON.stringify(voice))
        meSpeak.loadVoice(safeVoice)
        initialized = true
    }

    const speak = async (text: string, options: Partial<SpeakOptions> = {}) => {
        if (!import.meta.client || !text?.length) return
        if (!meSpeak) await init()

        meSpeak!.speak(text, {
            ...options,
        })
    }

    const speakWithUserId = async (text: string, userId: string, additionalOptions: Partial<SpeakOptions> = {}) => {
        if (!import.meta.client || !text?.length) return
        if (!meSpeak) await init()

        // Generate voice parameters based on user ID
        const voiceParams = uidToVoiceParams(userId);

        // Merge with any additional options
        meSpeak!.speak(text, {
            ...voiceParams,
            ...additionalOptions,
        })
    }

    return { speak, speakWithUserId, init, uidToVoiceParams }
}
