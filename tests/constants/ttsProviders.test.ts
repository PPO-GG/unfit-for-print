import { describe, it, expect } from 'vitest'
import { getProviderFromVoiceId, TTS_PROVIDERS } from '~/constants/ttsProviders'

describe('getProviderFromVoiceId', () => {
  it('returns elevenlabs for ElevenLabs voice ID', () => {
    expect(getProviderFromVoiceId(TTS_PROVIDERS.ELEVENLABS.id)).toBe('elevenlabs')
  })

  it('returns openai for OpenAI voice ID', () => {
    expect(getProviderFromVoiceId(TTS_PROVIDERS.OPENAI.id)).toBe('openai')
  })

  it('returns google for GOOGLE_MALE voice ID', () => {
    expect(getProviderFromVoiceId(TTS_PROVIDERS.GOOGLE_MALE.id)).toBe('google')
  })

  it('returns google for GOOGLE_FEMALE voice ID', () => {
    expect(getProviderFromVoiceId(TTS_PROVIDERS.GOOGLE_FEMALE.id)).toBe('google')
  })

  it('returns google for AU voice ID', () => {
    expect(getProviderFromVoiceId(TTS_PROVIDERS.GOOGLE_AU_B.id)).toBe('google')
  })

  it('returns google for UK voice ID', () => {
    expect(getProviderFromVoiceId(TTS_PROVIDERS.GOOGLE_GB_D.id)).toBe('google')
  })

  it('returns browser for unknown voice ID', () => {
    expect(getProviderFromVoiceId('some-browser-voice')).toBe('browser')
  })
})

describe('TTS_PROVIDERS', () => {
  it('GOOGLE_MALE has correct shape', () => {
    expect(TTS_PROVIDERS.GOOGLE_MALE).toEqual({
      id: 'google-neural2-male',
      apiVoice: 'en-US-Neural2-D',
      displayName: 'Google US Neural2-D (Male)',
    })
  })

  it('GOOGLE_FEMALE has correct shape', () => {
    expect(TTS_PROVIDERS.GOOGLE_FEMALE).toEqual({
      id: 'google-neural2-female',
      apiVoice: 'en-US-Neural2-C',
      displayName: 'Google US Neural2-C (Female)',
    })
  })

  it('GOOGLE_AU_A has correct shape', () => {
    expect(TTS_PROVIDERS.GOOGLE_AU_A).toEqual({
      id: 'google-neural2-au-a',
      apiVoice: 'en-AU-Neural2-A',
      displayName: 'Google AU Neural2-A (Female)',
    })
  })

  it('GOOGLE_GB_B has correct shape', () => {
    expect(TTS_PROVIDERS.GOOGLE_GB_B).toEqual({
      id: 'google-neural2-gb-b',
      apiVoice: 'en-GB-Neural2-B',
      displayName: 'Google UK Neural2-B (Male)',
    })
  })

  it('all google voice IDs start with google-neural2-', () => {
    const googleKeys = Object.keys(TTS_PROVIDERS).filter((k) => k.startsWith('GOOGLE_'))
    for (const key of googleKeys) {
      const provider = TTS_PROVIDERS[key as keyof typeof TTS_PROVIDERS]
      expect(provider.id).toMatch(/^google-neural2-/)
    }
  })
})
