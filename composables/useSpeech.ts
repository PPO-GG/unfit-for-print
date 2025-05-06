import { ref } from 'vue'
import { ElevenLabsClient } from 'elevenlabs'

const ELEVENLABS_API_KEY = 'sk_6ae0a08c2031c216ad07de6f421bfa79a160ef7d2473779a' // Only needed for local dev or model lookup if needed client-side
const client = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY })

const voiceModelCache = new Map<string, string>()

export function useSpeech(defaultVoiceId = 'pzxut4zZz4GImZNlqQ3H') {
    const isSpeaking = ref(false)
    const queue = ref<string[]>([])
    const audio = new Audio()

    const playNext = async () => {
        if (isSpeaking.value || queue.value.length === 0) return
        const text = queue.value.shift()
        if (!text) return

        isSpeaking.value = true

        try {
            const response = await fetch('/api/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    voiceId: defaultVoiceId,
                    modelId: 'eleven_multilingual_v2',
                }),
            })

            const contentType = response.headers.get('Content-Type') || ''
            if (!response.ok || !contentType.includes('audio')) {
                console.error('TTS response error:', await response.text())
                isSpeaking.value = false
                playNext()
                return
            }

            const blob = await response.blob()
            audio.src = URL.createObjectURL(blob)

            audio.onended = () => {
                isSpeaking.value = false
                playNext()
            }

            audio.onerror = (e) => {
                console.error('Audio error', e)
                isSpeaking.value = false
                playNext()
            }

            await audio.play()
        } catch (err) {
            console.error('Speech error:', err)
            isSpeaking.value = false
            playNext()
        }
    }

    const speak = (text: string) => {
        if (!text) return
        queue.value.push(text)
        playNext()
    }

    return { speak, isSpeaking }
}
