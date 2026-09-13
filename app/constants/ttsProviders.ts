export type TTSProviderType =
  | "browser"
  | "kokoro";

export const TTS_PROVIDERS = {
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
  KOKORO_BM_V0LEWIS: {
    id: "kokoro-bm_v0lewis",
    apiVoice: "bm_v0lewis",
    displayName: "Kokoro · Lewis (British M)",
  },
  KOKORO_FF_SIWIS: {
    id: "kokoro-ff_siwis",
    apiVoice: "ff_siwis",
    displayName: "Kokoro · Siwis (French F)",
  },
};

/** The voice every new user starts with */
export const DEFAULT_TTS_VOICE = TTS_PROVIDERS.KOKORO_AF_NICOLE;

/**
 * Helper function to determine the TTS provider from a voice ID
 */
export const getProviderFromVoiceId = (voiceId: string): TTSProviderType => {
  if (voiceId.startsWith("kokoro-")) return "kokoro";
  return "browser";
};
