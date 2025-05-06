// server/api/speak.post.ts
import { ElevenLabsClient } from 'elevenlabs'
import { Readable } from 'node:stream'

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! })

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { text, voiceId, modelId } = body as {
        text: string
        voiceId: string
        modelId: string
    }

    if (!text || !voiceId || !modelId) {
        throw createError({ statusCode: 400, statusMessage: 'Missing required fields' })
    }

    const stream = await client.textToSpeech.convertAsStream(voiceId, {
        text,
        model_id: modelId,
        output_format: 'mp3_44100_128',
        voice_settings: {
            stability: 0.4,
            similarity_boost: 0.75,
        },
    })

    setResponseHeaders(event, {
        'Content-Type': 'audio/mpeg',
    })

    return sendStream(event, stream as Readable)
})
