<template>
  <div class="flex flex-col items-center justify-center">
    <LoadingOverlay :is-loading="isLoading" />
    <div
      class="px-4 py-8 flex flex-col items-center text-center select-none pointer-events-none"
    >
      <img
        src="/img/ufp2.svg"
        alt="Unfit For Print Logo"
        class="mx-auto w-32 md:w-64 h-auto drop-shadow-xl drop-shadow-black/25"
      />
    </div>
    <div class="flex justify-center gap-6">
      <div
        class="outline-2 outline-dashed dark:outline-slate-300/25 outline-slate-900/25 outline-offset-4 rounded-xl"
      >
        <BlackCard
          v-if="blackCard"
          :back-logo-url="'/img/ufp.svg'"
          :card-id="blackCard.$id"
          :cardPack="blackCard.pack"
          :flipped="blackCardFlipped"
          :mask-url="'/img/textures/hexa.webp'"
          :num-pick="randomCard.pick"
          :shine="shine"
          :text="blackCard.text"
          :threeDeffect="threeDeffect"
          @click="blackCardFlipped = !blackCardFlipped"
        />
        <div
          v-else
          class="flex items-center p-2 text-white mt-4 w-40 md:w-56 lg:w-60 xl:w-68 2xl:w-72 aspect-[3/4] bg-[#1c2342] rounded-xl border-6 border-slate-800"
        >
          <div class="grid gap-2">
            <USkeleton
              class="h-4 w-30 md:w-44 lg:w-48 xl:w-56 2xl:w-60 bg-slate-600/50"
            />
            <USkeleton
              class="h-4 w-26 md:w-40 lg:w-44 xl:w-52 2xl:w-56 bg-slate-600/50"
            />
          </div>
        </div>
      </div>

      <div
        class="outline-2 outline-dashed dark:outline-slate-300/25 outline-slate-900/25 outline-offset-4 rounded-xl"
      >
        <WhiteCard
          v-if="whiteCard"
          :back-logo-url="'/img/ufp.svg'"
          :card-id="whiteCard.$id"
          :card-pack="whiteCard.pack"
          :flipped="whiteCardFlipped"
          :mask-url="'/img/textures/hexa2.webp'"
          :shine="shine"
          :text="whiteCard.text"
          :three-deffect="threeDeffect"
          @click="whiteCardFlipped = !whiteCardFlipped"
        />
        <div
          v-else
          class="flex items-center p-2 text-white mt-4 w-40 md:w-56 lg:w-60 xl:w-68 2xl:w-72 aspect-[3/4] bg-[#e7e1de] rounded-xl border-6 border-stone-400/50"
        >
          <div class="grid gap-2">
            <USkeleton
              class="h-4 w-30 md:w-44 lg:w-48 xl:w-56 2xl:w-60 bg-stone-400/50"
            />
            <USkeleton
              class="h-4 w-26 md:w-40 lg:w-44 xl:w-52 2xl:w-56 bg-stone-400/50"
            />
          </div>
        </div>
      </div>
    </div>
    <div class="flex flex-col items-center mt-8">
      <ClientOnly>
        <UFieldGroup>
          <UButton
            :loading="isFetching"
            class="text-xl py-2 px-4 cursor-pointer font-['Bebas_Neue']"
            color="secondary"
            icon="i-solar-layers-minimalistic-bold-duotone"
            variant="subtle"
            @click="handleTryMeClick"
          >
            {{ t("try_me") }}
          </UButton>
          <UButton
            :disabled="isSpeaking"
            :loading="isSpeaking"
            class="text-xl py-2 px-4 cursor-pointer font-['Bebas_Neue']"
            color="primary"
            icon="i-solar-user-speak-bold-duotone"
            variant="subtle"
            @click="handleSpeakClick"
          />
          <!-- <ShareImage
            v-if="blackCard && whiteCard"
            :black-card="{
              id: blackCard.$id,
              text: blackCard.text,
              pick: blackCard.pick,
            }"
            :white-card-ids="[whiteCard.$id]"
          >
            Share
          </ShareImage> -->
        </UFieldGroup>
      </ClientOnly>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from "vue";
import { useCards } from "~/composables/useCards";
import { useVibrate } from "@vueuse/core";
import { useSpeech } from "~/composables/useSpeech";
import { mergeCardText } from "~/composables/useMergeCards";
import { useI18n } from "vue-i18n";
import { useUserPrefsStore } from "@/stores/userPrefsStore";
import {
  TTS_PROVIDERS,
  getProviderFromVoiceId,
} from "~/constants/ttsProviders";
import { useUserStore } from "~/stores/userStore";
import ShareImage from "~/components/game/ShareImage.vue";
import { SFX } from "~/config/sfx.config";
type TTSProvider = "browser" | "elevenlabs" | "openai";

const {
  proxy: { event },
} = useScriptRybbitAnalytics();
const isLoading = ref(true);
const { t } = useI18n();
const userPrefs = useUserPrefsStore();
const openAIConfig = TTS_PROVIDERS.OPENAI;
const elevenLabsConfig = TTS_PROVIDERS.ELEVENLABS;
const whiteCard = ref<any>(null);
const blackCard = ref<any>(null);
const blackCardFlipped = ref(true);
const whiteCardFlipped = ref(true);
const threeDeffect = ref(true);
const shine = ref(true);
const { fetchRandomCard } = useCards();
const randomCard = ref<any>({ pick: 1 });
const { playSfx } = useSfx();
const { notify } = useNotifications();
const isFetching = ref(false);
const userStore = useUserStore();

let speechService = {
  speak: (provider: TTSProvider, text: string) => {
    // `Speaking with ${provider} speech: ${text}`);
  },
  isSpeaking: ref(false),
};

if (typeof window !== "undefined") {
  speechService = useSpeech({
    elevenLabsVoiceId: elevenLabsConfig.apiVoice,
    openAIVoice: openAIConfig.apiVoice,
  });
}

const isClient = computed(() => {
  return typeof window !== "undefined";
});

const currentProvider = computed(
  (): TTSProvider => getProviderFromVoiceId(userPrefs.ttsVoice),
);

const isSpeaking = computed(() => {
  if (!isClient.value) return false;
  return speechService.isSpeaking.value;
});

const speak = (text: string) => {
  if (!isClient.value || !text) return;
  speechService.speak(currentProvider.value, text);
};

const handleSpeakClick = () => {
  if (!blackCard.value || !whiteCard.value) return;
  const mergedText = mergeCardText(blackCard.value.text, whiteCard.value.text);
  if (!mergedText) return;
  speak(mergedText);
  console.info(
    "%c%s",
    "color:lightblue;font-weight:bold;font-size:2em;text-transform:uppercase;",
    mergedText,
  );
};

const handleTryMeClick = () => {
  fetchNewCards();
  if (isClient.value) {
    event("FetchCards", {
      userId: `${userStore.user?.$id || "anonymous"}`,
      combo: `${mergeCardText(blackCard.value.text, whiteCard.value.text)}`,
    });
  }
};

const { vibrate } = useVibrate({ pattern: [10, 7, 5], interval: 0 });
useHead({
  title: `Unfit for Print`,
});

const fetchNewCards = async () => {
  if (isFetching.value) return;
  isFetching.value = true;

  whiteCardFlipped.value = true;
  blackCardFlipped.value = true;

  if (isClient.value) {
    await playSfx(SFX.cardThrow, { pitch: [0.8, 1.2], volume: 0.75 });
  }

  setTimeout(() => {
    if (isClient.value) {
      vibrate();
    }

    fetchRandomCard("black", 1)
      .then((card: any) => {
        blackCard.value = card;
        randomCard.value = card;
        blackCardFlipped.value = false;

        return fetchRandomCard("white");
      })
      .then((card: any) => {
        whiteCard.value = card;
        whiteCardFlipped.value = false;
      });

    setTimeout(() => {
      isFetching.value = false;
    }, 1250);
  });
};

onMounted(() => {
  fetchNewCards();

  // Hide loading overlay after a short delay
  setTimeout(() => {
    isLoading.value = false;
  }, 500);
});
</script>
