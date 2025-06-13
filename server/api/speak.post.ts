// server/api/speak.post.ts
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
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

    const stream = await client.textToSpeech.stream(voiceId, {
        text,
        modelId,
    })

    setResponseHeaders(event, {
        'Content-Type': 'audio/mpeg',
    })

    return sendStream(event, stream as Readable)
})
