import { ref } from 'vue'
export function useSpeech(defaultVoiceId = 'pzxut4zZz4GImZNlqQ3H') {
    const isSpeaking = ref(false)
    const queue = ref<string[]>([])
    let audio: HTMLAudioElement | null = null

    if (import.meta.client) {
        audio = new Audio()
    }

    const playNext = async () => {
        if (!import.meta.client || !audio || isSpeaking.value || queue.value.length === 0) return
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
                await playNext()
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
            await playNext()
        }
    }

    const speak = (text: string) => {
        if (!import.meta.client || !text) return
        queue.value.push(text)
        playNext()
    }

    return { speak, isSpeaking }
}
