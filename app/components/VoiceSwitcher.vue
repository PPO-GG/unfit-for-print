<script lang="ts" setup>
import type { DropdownMenuItem } from '@nuxt/ui'
import { useUserPrefsStore } from "@/stores/userPrefsStore";
import { ref, computed, onMounted } from "vue";
import { useBrowserSpeech } from "~/composables/useBrowserSpeech";
import { TTS_PROVIDERS } from "~/constants/ttsProviders";
import { useVoicePreview, type VoicePreviewDescriptor } from "~/composables/useVoicePreview";

interface VoiceDropdownMenuItem extends DropdownMenuItem {
  voiceDescriptor?: VoicePreviewDescriptor;
}

const userPrefs = useUserPrefsStore();
const voices = ref<SpeechSynthesisVoice[]>([]);
const { getVoices, isVoiceAvailable } = useBrowserSpeech();
const { activeVoiceId, isLoading, playPreview, stopPreview } = useVoicePreview();

const kokoroVoiceConfigs = Object.values(TTS_PROVIDERS).filter((p) =>
  p.id.startsWith("kokoro-"),
);
const kokoroVoiceIdSet = new Set(kokoroVoiceConfigs.map((p) => p.id));

const findBestMatchingVoice = (): SpeechSynthesisVoice | null => {
  const preferredLang = userPrefs.preferredLanguage.toLowerCase();
  let bestMatch = voices.value.find((voice) =>
    voice.lang.toLowerCase().startsWith(preferredLang),
  );
  if (!bestMatch) {
    bestMatch = voices.value.find(
      (voice) => voice.lang.toLowerCase().split("-")[0] === preferredLang,
    );
  }
  return bestMatch || voices.value[0] || null;
};

const updateVoice = () => {
  // Kokoro voices are valid for all users — keep as-is
  if (kokoroVoiceIdSet.has(userPrefs.ttsVoice)) return;
  if (!isVoiceAvailable(userPrefs.ttsVoice)) {
    const bestMatch = findBestMatchingVoice();
    userPrefs.ttsVoice = bestMatch?.name || voices.value[0]?.name || "";
  }
};

const loadVoices = () => {
  voices.value = getVoices();

  if (!userPrefs.ttsVoice) {
    const bestMatch = findBestMatchingVoice();
    userPrefs.ttsVoice = bestMatch?.name || voices.value[0]?.name || "";
  } else {
    // A saved voice that no longer exists (a removed Google/OpenAI/ElevenLabs
    // or Kokoro voice) falls through to here and is swapped for a browser one.
    updateVoice();
  }
};

const items = computed<VoiceDropdownMenuItem[]>(() => {
  const result: VoiceDropdownMenuItem[] = [];

  // Kokoro TTS — all users
  result.push({
    label: "Kokoro TTS",
    icon: "i-solar-magic-stick-3-bold-duotone",
    children: kokoroVoiceConfigs.map((config) => ({
      label: config.displayName,
      color: (userPrefs.ttsVoice === config.id ? "primary" : undefined) as any,
      icon: userPrefs.ttsVoice === config.id
        ? "i-solar-user-speak-bold-duotone"
        : undefined,
      slot: "voice",
      voiceDescriptor: {
        provider: "kokoro" as const,
        voiceId: config.id,
        apiVoice: config.apiVoice,
        speed: (config as any).speed,
      },
      onSelect: () => { userPrefs.ttsVoice = config.id },
    })),
  });

  // Browser TTS — cloud-based browser voices (localService === false)
  const browserVoices = [...voices.value]
    .filter((v) => !v.localService)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (browserVoices.length) {
    result.push({
      label: "Browser TTS",
      icon: "i-solar-global-bold-duotone",
      children: browserVoices.map((voice) => ({
        label: voice.name,
        color: (userPrefs.ttsVoice === voice.name ? "primary" : undefined) as any,
        icon: userPrefs.ttsVoice === voice.name
          ? "i-solar-user-speak-bold-duotone"
          : undefined,
        slot: "voice",
        voiceDescriptor: {
          provider: "browser" as const,
          voiceId: `browser-${voice.name}`,
          voiceName: voice.name,
        },
        onSelect: () => { userPrefs.ttsVoice = voice.name },
      })),
    });
  }

  // OS TTS — native OS voices (localService === true)
  const osVoices = [...voices.value]
    .filter((v) => v.localService)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (osVoices.length) {
    result.push({
      label: "OS TTS",
      icon: "i-solar-cpu-bold-duotone",
      children: osVoices.map((voice) => ({
        label: voice.name,
        color: (userPrefs.ttsVoice === voice.name ? "primary" : undefined) as any,
        icon: userPrefs.ttsVoice === voice.name
          ? "i-solar-user-speak-bold-duotone"
          : undefined,
        slot: "voice",
        voiceDescriptor: {
          provider: "browser" as const,
          voiceId: `os-${voice.name}`,
          voiceName: voice.name,
        },
        onSelect: () => { userPrefs.ttsVoice = voice.name },
      })),
    });
  }

  return result;
});

onMounted(() => {
  if (typeof window !== "undefined" && typeof speechSynthesis !== "undefined") {
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
    setTimeout(loadVoices, 500);
  }
});
</script>

<template>
  <ClientOnly>
    <UDropdownMenu
      :content="{
        align: 'start',
        side: 'bottom',
        sideOffset: 8,
      }"
      :items="items"
      :ui="{
        content: 'w-72 max-h-72 overflow-y-auto',
      }"
      @update:open="(isOpen) => { if (!isOpen) stopPreview(); }"
    >
      <UButton
        class="flex items-center gap-2 text-xs"
        color="neutral"
        icon="i-solar-user-speak-bold-duotone"
        variant="ghost"
      >
        <span>TTS Voice</span>
      </UButton>

      <template #voice-trailing="{ item }">
        <button
          type="button"
          class="p-1 rounded-md transition-colors hover:bg-white/15 text-slate-400 hover:text-white cursor-pointer inline-flex items-center justify-center shrink-0"
          :title="(item as VoiceDropdownMenuItem).voiceDescriptor && activeVoiceId === (item as VoiceDropdownMenuItem).voiceDescriptor?.voiceId ? 'Stop preview' : 'Preview voice'"
          :aria-label="(item as VoiceDropdownMenuItem).voiceDescriptor && activeVoiceId === (item as VoiceDropdownMenuItem).voiceDescriptor?.voiceId ? 'Stop preview' : 'Preview voice'"
          @click.stop.prevent="(item as VoiceDropdownMenuItem).voiceDescriptor && playPreview((item as VoiceDropdownMenuItem).voiceDescriptor!)"
        >
          <UIcon
            v-if="isLoading && (item as VoiceDropdownMenuItem).voiceDescriptor && activeVoiceId === (item as VoiceDropdownMenuItem).voiceDescriptor?.voiceId"
            name="i-solar-spinner-linear"
            class="size-3.5 animate-spin text-primary"
          />
          <UIcon
            v-else-if="(item as VoiceDropdownMenuItem).voiceDescriptor && activeVoiceId === (item as VoiceDropdownMenuItem).voiceDescriptor?.voiceId"
            name="i-solar-stop-circle-bold-duotone"
            class="size-3.5 text-primary animate-pulse"
          />
          <UIcon
            v-else
            name="i-solar-play-circle-bold-duotone"
            class="size-3.5 opacity-70 hover:opacity-100"
          />
        </button>
      </template>
    </UDropdownMenu>
  </ClientOnly>
</template>

<style scoped></style>
