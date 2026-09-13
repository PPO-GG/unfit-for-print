import { describe, it, expect } from 'vitest'
import { getProviderFromVoiceId, TTS_PROVIDERS, DEFAULT_TTS_VOICE } from '~/constants/ttsProviders'
import { KOKORO_ALLOWED_VOICES } from '~~/server/api/kokoro-speak.post'

describe('getProviderFromVoiceId', () => {
  it('returns kokoro for any kokoro- prefixed ID', () => {
    expect(getProviderFromVoiceId('kokoro-af_heart')).toBe('kokoro')
    expect(getProviderFromVoiceId('kokoro-bm_v0lewis')).toBe('kokoro')
  })

  it('returns browser for unknown voice ID', () => {
    expect(getProviderFromVoiceId('some-browser-voice')).toBe('browser')
  })

  it('treats a saved voice from a removed provider as browser', () => {
    // Players' prefs can still hold these ids; they must not route to an
    // endpoint that no longer has a client path.
    expect(getProviderFromVoiceId('google-neural2-male')).toBe('browser')
    expect(getProviderFromVoiceId('openai-fable')).toBe('browser')
    expect(getProviderFromVoiceId('NuIlfu52nTXRM2NXDrjS')).toBe('browser')
  })
})

describe('Kokoro voices', () => {
  const kokoro = Object.values(TTS_PROVIDERS)

  it('every voice id is kokoro- prefixed and unique', () => {
    const ids = kokoro.map((p) => p.id)
    for (const id of ids) expect(id).toMatch(/^kokoro-/)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every voice id matches its apiVoice', () => {
    // The id is what gets saved to prefs; the apiVoice is what Kokoro is sent.
    // A mismatch means the picker labels one voice and plays another.
    for (const p of kokoro) expect(p.id).toBe(`kokoro-${p.apiVoice}`)
  })

  it('every voice the picker offers is accepted by /api/kokoro-speak', () => {
    for (const p of kokoro) expect(KOKORO_ALLOWED_VOICES.has(p.apiVoice)).toBe(true)
  })

  it('the default voice is a Kokoro voice', () => {
    expect(getProviderFromVoiceId(DEFAULT_TTS_VOICE.id)).toBe('kokoro')
  })
})
