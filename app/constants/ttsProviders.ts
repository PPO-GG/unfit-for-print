// Define the provider types locally to avoid import issues
type TTSProviderType = "browser" | "elevenlabs" | "openai" | "google";

export const TTS_PROVIDERS = {
  OPENAI: {
    // "Input should be 'nova', 'shimmer', 'echo', 'onyx', 'fable', 'alloy', 'ash', 'sage' or 'coral' \\
    id: "openai-fable",
    apiVoice: "fable",
    displayName: "OpenAI TTS (fable)",
  },
  ELEVENLABS: {
    id: "NuIlfu52nTXRM2NXDrjS",
    apiVoice: "NuIlfu52nTXRM2NXDrjS", // Same as ID for ElevenLabs
    displayName: "ElevenLabs AI Voice",
  },
  // US voices
  GOOGLE_MALE: {
    id: "google-neural2-male",
    apiVoice: "en-US-Neural2-D",
    displayName: "Google US Neural2-D (Male)",
  },
  GOOGLE_FEMALE: {
    id: "google-neural2-female",
    apiVoice: "en-US-Neural2-C",
    displayName: "Google US Neural2-C (Female)",
  },
  GOOGLE_US_A: {
    id: "google-neural2-us-a",
    apiVoice: "en-US-Neural2-A",
    displayName: "Google US Neural2-A (Male)",
  },
  GOOGLE_US_E: {
    id: "google-neural2-us-e",
    apiVoice: "en-US-Neural2-E",
    displayName: "Google US Neural2-E (Female)",
  },
  GOOGLE_US_F: {
    id: "google-neural2-us-f",
    apiVoice: "en-US-Neural2-F",
    displayName: "Google US Neural2-F (Female)",
  },
  // AU voices
  GOOGLE_AU_A: {
    id: "google-neural2-au-a",
    apiVoice: "en-AU-Neural2-A",
    displayName: "Google AU Neural2-A (Female)",
  },
  GOOGLE_AU_B: {
    id: "google-neural2-au-b",
    apiVoice: "en-AU-Neural2-B",
    displayName: "Google AU Neural2-B (Male)",
  },
  GOOGLE_AU_C: {
    id: "google-neural2-au-c",
    apiVoice: "en-AU-Neural2-C",
    displayName: "Google AU Neural2-C (Female)",
  },
  GOOGLE_AU_D: {
    id: "google-neural2-au-d",
    apiVoice: "en-AU-Neural2-D",
    displayName: "Google AU Neural2-D (Male)",
  },
  // UK voices
  GOOGLE_GB_A: {
    id: "google-neural2-gb-a",
    apiVoice: "en-GB-Neural2-A",
    displayName: "Google UK Neural2-A (Female)",
  },
  GOOGLE_GB_B: {
    id: "google-neural2-gb-b",
    apiVoice: "en-GB-Neural2-B",
    displayName: "Google UK Neural2-B (Male)",
  },
  GOOGLE_GB_C: {
    id: "google-neural2-gb-c",
    apiVoice: "en-GB-Neural2-C",
    displayName: "Google UK Neural2-C (Female)",
  },
  GOOGLE_GB_D: {
    id: "google-neural2-gb-d",
    apiVoice: "en-GB-Neural2-D",
    displayName: "Google UK Neural2-D (Male)",
  },
  GOOGLE_GB_F: {
    id: "google-neural2-gb-f",
    apiVoice: "en-GB-Neural2-F",
    displayName: "Google UK Neural2-F (Female)",
  },
};

/**
 * Helper function to determine the TTS provider from a voice ID
 */
export const getProviderFromVoiceId = (voiceId: string): TTSProviderType => {
  if (voiceId === TTS_PROVIDERS.ELEVENLABS.id) return "elevenlabs";
  if (voiceId === TTS_PROVIDERS.OPENAI.id) return "openai";
  if (voiceId.startsWith("google-neural2-")) return "google";
  return "browser";
};
