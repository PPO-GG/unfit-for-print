import { ref } from "vue";
import { useBrowserSpeech } from "./useBrowserSpeech";

// Define provider types
export type TTSProvider = "browser" | "elevenlabs" | "openai";

// Define options for each provider
export interface TTSOptions {
  // Browser TTS options
  browserVoice?: string;
  browserRate?: number;

  // ElevenLabs options
  elevenLabsVoiceId?: string;
  elevenLabsModelId?: string;

  // OpenAI options
  openAIVoice?: string;
  openAIModel?: string;
}

// Default options
const defaultOptions: TTSOptions = {
  // Browser defaults
  browserRate: 1.0,

  // ElevenLabs defaults
  elevenLabsVoiceId: "pzxut4zZz4GImZNlqQ3H",
  elevenLabsModelId: "eleven_multilingual_v2",

  // OpenAI defaults
  openAIVoice: "nova",
  openAIModel: "tts-1",
};

export function useSpeech(options: TTSOptions = {}) {
  // Merge provided options with defaults
  const mergedOptions = { ...defaultOptions, ...options };

  // State
  const isSpeaking = ref(false);
  const queue = ref<{ provider: TTSProvider; text: string }[]>([]);
  let audio: HTMLAudioElement | null = null;

  // Initialize browser speech
  const browserSpeech = useBrowserSpeech();

  if (import.meta.client) {
    audio = new Audio();
  }

  const playNext = async () => {
    if (!import.meta.client || isSpeaking.value || queue.value.length === 0)
      return;

    const item = queue.value.shift();
    if (!item) return;

    const { provider, text } = item;

    isSpeaking.value = true;

    try {
      if (provider === "browser") {
        // Use browser speech synthesis
        browserSpeech.speak(
          text,
          mergedOptions.browserVoice,
          mergedOptions.browserRate,
        );

        // Set up event listener for when browser speech ends
        const checkSpeaking = setInterval(() => {
          if (!browserSpeech.isSpeaking.value) {
            clearInterval(checkSpeaking);
            isSpeaking.value = false;
            playNext();
          }
        }, 100);

        return;
      }

      // For API-based TTS (ElevenLabs and OpenAI)
      if (!audio) return;

      let endpoint: string;
      let payload: any;

      if (provider === "elevenlabs") {
        endpoint = "/api/speak";
        payload = {
          text,
          voiceId: mergedOptions.elevenLabsVoiceId,
          modelId: mergedOptions.elevenLabsModelId,
        };
      } else if (provider === "openai") {
        endpoint = "/api/openai-speak";
        payload = {
          text,
          voice: mergedOptions.openAIVoice,
          model: mergedOptions.openAIModel,
        };
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }

      const userStore = useUserStore();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userStore.session?.$id}`,
          "x-appwrite-user-id": userStore.user?.$id ?? "",
        },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("Content-Type") || "";
      if (!response.ok || !contentType.includes("audio")) {
        console.error(
          `TTS response error (${provider}):`,
          await response.text(),
        );
        isSpeaking.value = false;
        await playNext();
        return;
      }

      const blob = await response.blob();
      audio.src = URL.createObjectURL(blob);

      audio.onended = () => {
        isSpeaking.value = false;
        playNext();
      };

      audio.onerror = (e) => {
        console.error("Audio error", e);
        isSpeaking.value = false;
        playNext();
      };

      await audio.play();
    } catch (err) {
      console.error(`Speech error (${provider}):`, err);
      isSpeaking.value = false;
      await playNext();
    }
  };

  const speak = (provider: TTSProvider, text: string) => {
    if (!import.meta.client || !text) return;
    queue.value.push({ provider, text });
    playNext();
  };

  return { speak, isSpeaking };
}
