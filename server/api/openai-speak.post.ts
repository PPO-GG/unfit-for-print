// api/openai-speak.post.ts
import { defineEventHandler, readBody, createError, sendStream } from 'h3'
import { Readable } from 'stream'

export default defineEventHandler(async (event) => {
    const { text, voice = 'nova', model = 'tts-1' } = await readBody(event)

    if (!text) {
        throw createError({ statusCode: 400, statusMessage: 'Missing text parameter' })
    }

    const resp = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, input: text, voice }),
    })

    if (!resp.ok) {
        const err = await resp.text()
        throw createError({ statusCode: resp.status, statusMessage: err })
    }

    event.node.res.setHeader('Content-Type', 'audio/mpeg')
    return sendStream(event, Readable.from(resp.body as any))
})
