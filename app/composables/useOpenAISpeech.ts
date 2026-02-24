// composables/useOpenAISpeech.ts
import { ref } from "vue";

export function useOpenAISpeech(defaultVoice = "nova", model = "tts-001") {
  const isSpeaking = ref(false);
  const queue = ref<string[]>([]);
  let audio: HTMLAudioElement | null = null;

  if (import.meta.client) {
    audio = new Audio();
  }

  const playNext = async () => {
    if (
      !import.meta.client ||
      !audio ||
      isSpeaking.value ||
      queue.value.length === 0
    )
      return;

    const text = queue.value.shift();
    if (!text) return;

    isSpeaking.value = true;

    try {
      const userStore = useUserStore();
      const response = await fetch("/api/openai-speak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userStore.session?.$id}`,
          "x-appwrite-user-id": userStore.user?.$id ?? "",
        },
        body: JSON.stringify({
          text,
          voice: defaultVoice,
          model,
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`);
      }

      const blob = await response.blob();
      audio.src = URL.createObjectURL(blob);

      audio.onended = () => {
        isSpeaking.value = false;
        playNext();
      };

      audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        isSpeaking.value = false;
        playNext();
      };

      await audio.play();
    } catch (error) {
      console.error("TTS Error:", error);
      isSpeaking.value = false;
      playNext();
    }
  };

  return { isSpeaking, queue, playNext };
}
