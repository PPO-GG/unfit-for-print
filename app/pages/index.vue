<template>
  <div class="flex flex-col items-center justify-center">
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
          class="flex items-center p-2 text-white w-[clamp(6rem,12vw,18rem)] aspect-[3/4] bg-[#1c2342] rounded-xl"
        >
          <div class="grid gap-2 w-full px-2">
            <USkeleton class="h-4 w-[85%] bg-slate-600/50" />
            <USkeleton class="h-4 w-[70%] bg-slate-600/50" />
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
          class="flex items-center p-2 text-white w-[clamp(6rem,12vw,18rem)] aspect-[3/4] bg-[#e7e1de] rounded-xl shadow-[inset_0_0_0_6px_theme(colors.stone.400/50)]"
        >
          <div class="grid gap-2 w-full px-2">
            <USkeleton class="h-4 w-[85%] bg-stone-400/50" />
            <USkeleton class="h-4 w-[70%] bg-stone-400/50" />
          </div>
        </div>
      </div>
    </div>
    <div class="flex flex-col items-center mt-8">
      <ClientOnly>
        <UFieldGroup>
          <UButton
            :loading="isFetching"
            class="text-xl py-2 px-4 cursor-pointer"
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
            class="text-xl py-2 px-4 cursor-pointer"
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
const router = useRouter();
const route = useRoute();

// Safety net: if OAuth redirect (with secret & userId) accidentally lands
// on the root page instead of /auth/callback (e.g. due to service worker
// interception), forward to the correct callback handler.
if (import.meta.client) {
  const oauthUserId = route.query.userId as string;
  const oauthSecret = route.query.secret as string;
  if (oauthUserId && oauthSecret) {
    router.replace({
      path: "/auth/callback",
      query: { userId: oauthUserId, secret: oauthSecret },
    });
  }
}

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
});
</script>
