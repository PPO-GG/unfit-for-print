import type { SpeakOptions } from 'mespeak'

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

    const pitch = Math.min(150, 10 + (hash % 121))
    const speed = Math.min(150, 25 + ((hash >> 3) % 121))
    const wordgap = 1
    const amplitude = Math.min(200, 80 + ((hash >> 7) % 41))

    return {
        pitch,
        speed,
        wordgap,
        amplitude,
        volume: 1,
    }
}

export async function useMeSpeak() {
    const init = async () => {
        if (!import.meta.client || initialized) return

        const [{ default: mespeak }, config, voice] = await Promise.all([
            import('mespeak'),
            import('mespeak/src/mespeak_config.json'),
            import('mespeak/voices/en/en.json'),
        ])

        meSpeak = mespeak
        meSpeak.loadConfig(config)

        const safeVoice = JSON.parse(JSON.stringify(voice))
        meSpeak.loadVoice(safeVoice)

        initialized = true
    }

    const speak = async (text: string, options: Partial<SpeakOptions> = {}) => {
        if (!import.meta.client || !text?.length) return
        if (!meSpeak) await init()

        meSpeak!.speak(text, { ...options })
    }

    const speakWithUserId = async (
        text: string,
        userId: string,
        additionalOptions: Partial<SpeakOptions> = {}
    ) => {
        if (!import.meta.client || !text?.length) return
        if (!meSpeak) await init()

        const voiceParams = uidToVoiceParams(userId)
        meSpeak!.speak(text, { ...voiceParams, ...additionalOptions })
    }

    return { speak, speakWithUserId, init, uidToVoiceParams }
}
