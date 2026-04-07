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

  it('returns browser for unknown voice ID', () => {
    expect(getProviderFromVoiceId('some-browser-voice')).toBe('browser')
  })
})

describe('TTS_PROVIDERS', () => {
  it('GOOGLE_MALE has correct shape', () => {
    expect(TTS_PROVIDERS.GOOGLE_MALE).toEqual({
      id: 'google-neural2-male',
      apiVoice: 'en-US-Neural2-D',
      displayName: 'Google Neural2 (Male)',
    })
  })

  it('GOOGLE_FEMALE has correct shape', () => {
    expect(TTS_PROVIDERS.GOOGLE_FEMALE).toEqual({
      id: 'google-neural2-female',
      apiVoice: 'en-US-Neural2-C',
      displayName: 'Google Neural2 (Female)',
    })
  })
})
