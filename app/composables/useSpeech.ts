import { ref } from "vue";
import { useBrowserSpeech } from "./useBrowserSpeech";
import { TTS_PROVIDERS, type TTSProviderType } from "~/constants/ttsProviders";
import { applyVolume } from "~/utils/volume";

export type TTSProvider = TTSProviderType;

export interface TTSOptions {
  browserVoice?: string;
  browserRate?: number;
}

const defaultOptions: TTSOptions = {
  browserRate: 1.0,
};

export function applyTtsVolume(
  audioEl: HTMLAudioElement,
  ttsVolumePercent: number,
): void {
  applyVolume(audioEl, ttsVolumePercent);
}

export function useSpeech(options: TTSOptions = {}) {
  // Merge provided options with defaults
  const mergedOptions = { ...defaultOptions, ...options };

  // State
  const isSpeaking = ref(false);
  const queue = ref<{ provider: TTSProvider; text: string }[]>([]);
  let audio: HTMLAudioElement | null = null;

  // Initialize browser speech
  const browserSpeech = useBrowserSpeech();
  const userPrefs = useUserPrefsStore();

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

      // API-based TTS (Kokoro)
      if (!audio) return;

      let endpoint: string;
      let payload: any;

      if (provider === "kokoro") {
        endpoint = "/api/kokoro-speak";
        const kokoroConfig = Object.values(TTS_PROVIDERS).find(
          (p) => p.id === userPrefs.ttsVoice,
        );
        payload = {
          text,
          voice: kokoroConfig?.apiVoice ?? TTS_PROVIDERS.KOKORO_AF_BELLA.apiVoice,
          ...((kokoroConfig as any)?.speed != null && { speed: (kokoroConfig as any).speed }),
        };
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }

      // /api/kokoro-speak authenticates via requireAuth, which reads the
      // session cookie automatically sent with same-origin requests — no
      // manual Authorization header needed.
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
      applyTtsVolume(audio, userPrefs.ttsVolume);

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

  const stop = () => {
    // Clear any pending items
    queue.value = [];
    // Stop API-based audio
    if (audio) {
      audio.pause();
      audio.src = "";
    }
    // Stop browser speech
    browserSpeech.stop();
    isSpeaking.value = false;
  };

  return { speak, stop, isSpeaking };
}
