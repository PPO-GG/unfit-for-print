export type TTSProviderType =
  | "browser"
  | "elevenlabs"
  | "openai"
  | "google"
  | "kokoro";

export const TTS_PROVIDERS = {
  OPENAI: {
    id: "openai-fable",
    apiVoice: "fable",
    displayName: "OpenAI TTS (fable)",
  },
  ELEVENLABS: {
    id: "NuIlfu52nTXRM2NXDrjS",
    apiVoice: "NuIlfu52nTXRM2NXDrjS",
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
  // Kokoro TTS voices (grade C or above, available to all users)
  KOKORO_AF_HEART: {
    id: "kokoro-af_heart",
    apiVoice: "af_heart",
    displayName: "Kokoro · Heart (American F)",
  },
  KOKORO_AF_BELLA: {
    id: "kokoro-af_bella",
    apiVoice: "af_bella",
    displayName: "Kokoro · Bella (American F)",
  },
  KOKORO_AF_NICOLE: {
    id: "kokoro-af_nicole",
    apiVoice: "af_nicole",
    displayName: "Kokoro · Nicole (American F)",
    speed: 1.25,
  },
  KOKORO_AF_AOEDE: {
    id: "kokoro-af_aoede",
    apiVoice: "af_aoede",
    displayName: "Kokoro · Aoede (American F)",
  },
  KOKORO_AF_KORE: {
    id: "kokoro-af_kore",
    apiVoice: "af_kore",
    displayName: "Kokoro · Kore (American F)",
  },
  KOKORO_AF_SARAH: {
    id: "kokoro-af_sarah",
    apiVoice: "af_sarah",
    displayName: "Kokoro · Sarah (American F)",
  },
  KOKORO_AF_ALLOY: {
    id: "kokoro-af_alloy",
    apiVoice: "af_alloy",
    displayName: "Kokoro · Alloy (American F)",
  },
  KOKORO_AF_NOVA: {
    id: "kokoro-af_nova",
    apiVoice: "af_nova",
    displayName: "Kokoro · Nova (American F)",
  },
  KOKORO_AM_FENRIR: {
    id: "kokoro-am_fenrir",
    apiVoice: "am_fenrir",
    displayName: "Kokoro · Fenrir (American M)",
  },
  KOKORO_AM_MICHAEL: {
    id: "kokoro-am_michael",
    apiVoice: "am_michael",
    displayName: "Kokoro · Michael (American M)",
  },
  KOKORO_AM_PUCK: {
    id: "kokoro-am_puck",
    apiVoice: "am_puck",
    displayName: "Kokoro · Puck (American M)",
  },
  KOKORO_BF_EMMA: {
    id: "kokoro-bf_emma",
    apiVoice: "bf_emma",
    displayName: "Kokoro · Emma (British F)",
  },
  KOKORO_BF_ISABELLA: {
    id: "kokoro-bf_isabella",
    apiVoice: "bf_isabella",
    displayName: "Kokoro · Isabella (British F)",
  },
  KOKORO_BM_FABLE: {
    id: "kokoro-bm_fable",
    apiVoice: "bm_fable",
    displayName: "Kokoro · Fable (British M)",
  },
  KOKORO_BM_GEORGE: {
    id: "kokoro-bm_george",
    apiVoice: "bm_george",
    displayName: "Kokoro · George (British M)",
  },
  KOKORO_FF_SIWIS: {
    id: "kokoro-ff_siwis",
    apiVoice: "ff_siwis",
    displayName: "Kokoro · Siwis (French F)",
  },
};

/**
 * Helper function to determine the TTS provider from a voice ID
 */
export const getProviderFromVoiceId = (voiceId: string): TTSProviderType => {
  if (voiceId === TTS_PROVIDERS.ELEVENLABS.id) return "elevenlabs";
  if (voiceId === TTS_PROVIDERS.OPENAI.id) return "openai";
  if (voiceId.startsWith("google-neural2-")) return "google";
  if (voiceId.startsWith("kokoro-")) return "kokoro";
  return "browser";
};
