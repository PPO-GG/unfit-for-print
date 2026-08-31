import { ref, onScopeDispose, getCurrentScope } from "vue";
import { useBrowserSpeech } from "./useBrowserSpeech";
import { useUserPrefsStore } from "@/stores/userPrefsStore";
import { applyVolume } from "~/utils/volume";

export interface VoicePreviewDescriptor {
  provider: "kokoro" | "google" | "openai" | "elevenlabs" | "browser";
  voiceId: string;
  apiVoice?: string;
  speed?: number;
  voiceName?: string;
}

export const PREVIEW_TTS_TEXT = "This is what I sound like.";

export function useVoicePreview() {
  const activeVoiceId = ref<string | null>(null);
  const isLoading = ref(false);

  const browserSpeech = useBrowserSpeech();
  const userPrefs = useUserPrefsStore();

  let currentAudio: HTMLAudioElement | null = null;
  let currentBlobUrl: string | null = null;
  let browserPollInterval: ReturnType<typeof setInterval> | null = null;

  const cleanupAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = "";
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio = null;
    }
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
    if (browserPollInterval) {
      clearInterval(browserPollInterval);
      browserPollInterval = null;
    }
    browserSpeech.stop();
  };

  const stopPreview = () => {
    cleanupAudio();
    activeVoiceId.value = null;
    isLoading.value = false;
  };

  const playPreview = async (descriptor: VoicePreviewDescriptor) => {
    if (typeof window === "undefined") return;

    // Toggle off if already previewing this voice
    if (
      activeVoiceId.value === descriptor.voiceId &&
      (isLoading.value || currentAudio || browserSpeech.isSpeaking.value)
    ) {
      stopPreview();
      return;
    }

    stopPreview();
    activeVoiceId.value = descriptor.voiceId;
    isLoading.value = true;

    try {
      if (descriptor.provider === "browser") {
        isLoading.value = false;
        browserSpeech.speak(PREVIEW_TTS_TEXT, descriptor.voiceName, 1.0);

        browserPollInterval = setInterval(() => {
          if (!browserSpeech.isSpeaking.value) {
            stopPreview();
          }
        }, 100);
        return;
      }

      let endpoint = "";
      let payload: Record<string, any> = {};

      if (descriptor.provider === "kokoro") {
        endpoint = "/api/kokoro-speak";
        payload = {
          text: PREVIEW_TTS_TEXT,
          voice: descriptor.apiVoice,
          ...(descriptor.speed != null && { speed: descriptor.speed }),
        };
      } else if (descriptor.provider === "google") {
        endpoint = "/api/google-speak";
        payload = {
          text: PREVIEW_TTS_TEXT,
          voiceName: descriptor.apiVoice,
        };
      } else if (descriptor.provider === "openai") {
        endpoint = "/api/openai-speak";
        payload = {
          text: PREVIEW_TTS_TEXT,
          voice: descriptor.apiVoice || "fable",
          model: "tts-1",
        };
      } else if (descriptor.provider === "elevenlabs") {
        endpoint = "/api/speak";
        payload = {
          text: PREVIEW_TTS_TEXT,
          voiceId: descriptor.apiVoice,
          modelId: "eleven_multilingual_v2",
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(
          `Preview TTS error (${descriptor.provider}):`,
          await response.text(),
        );
        stopPreview();
        return;
      }

      const blob = await response.blob();
      currentBlobUrl = URL.createObjectURL(blob);

      const audio = new Audio(currentBlobUrl);
      currentAudio = audio;
      applyVolume(audio, userPrefs.ttsVolume);

      audio.onended = () => {
        stopPreview();
      };

      audio.onerror = (e) => {
        console.error("Audio preview error", e);
        stopPreview();
      };

      isLoading.value = false;
      await audio.play();
    } catch (err) {
      console.error("Failed to play voice preview:", err);
      stopPreview();
    }
  };

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stopPreview();
    });
  }

  return {
    activeVoiceId,
    isLoading,
    playPreview,
    stopPreview,
  };
}
