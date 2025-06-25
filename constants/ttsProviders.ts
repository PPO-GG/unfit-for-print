// Define the provider types locally to avoid import issues
type TTSProviderType = 'browser' | 'elevenlabs' | 'openai';

export const TTS_PROVIDERS = {
  OPENAI: {
    // "Input should be 'nova', 'shimmer', 'echo', 'onyx', 'fable', 'alloy', 'ash', 'sage' or 'coral' \\
    id: 'openai-fable',
    apiVoice: 'fable',
    displayName: 'OpenAI TTS (fable)'
  },
  ELEVENLABS: {
    id: 'NuIlfu52nTXRM2NXDrjS',
    apiVoice: 'NuIlfu52nTXRM2NXDrjS', // Same as ID for ElevenLabs
    displayName: 'ElevenLabs AI Voice'
  }
};

/**
 * Helper function to determine the TTS provider from a voice ID
 */
export const getProviderFromVoiceId = (voiceId: string): TTSProviderType => {
  if (voiceId === TTS_PROVIDERS.ELEVENLABS.id) return 'elevenlabs';
  if (voiceId === TTS_PROVIDERS.OPENAI.id) return 'openai';
  return 'browser';
};
