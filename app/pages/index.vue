<template>
  <div
    class="min-h-screen flex flex-col items-center justify-center px-4 py-8 select-none"
  >
    <!-- Avatar (top-right corner) -->
    <div class="fixed top-4 right-4 z-20">
      <NuxtLink v-if="userStore.user" to="/profile">
        <UAvatar
          :src="userStore.user?.prefs?.avatar"
          :alt="userStore.user?.name ?? 'Profile'"
          size="md"
          class="ring-2 ring-violet-500/40 hover:ring-violet-400/70 transition-all cursor-pointer"
        />
      </NuxtLink>
      <NuxtLink v-else to="/auth/login">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-solar-login-bold-duotone"
          size="sm"
          class="opacity-60 hover:opacity-100"
        >
          {{ t("nav.login_discord") }}
        </UButton>
      </NuxtLink>
    </div>

    <!-- Logo -->
    <div class="flex flex-col items-center mb-10 pointer-events-none">
      <img
        src="/img/ufp2.svg"
        alt="Unfit For Print Logo"
        class="w-20 sm:w-28 md:w-36 h-auto drop-shadow-xl mb-4"
      />
    </div>
    <div
      class="glass-panel rounded-2xl p-5 flex flex-col items-center gap-4 w-full max-w-sm"
    >
      <div class="flex justify-center gap-4">
        <!-- Black Card -->
        <div
          class="outline-2 outline-dashed dark:outline-slate-300/20 outline-slate-900/20 outline-offset-3 rounded-xl"
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
            :scale="80"
            @click="blackCardFlipped = !blackCardFlipped"
          />
          <div
            v-else
            class="flex items-center p-2 text-white w-[clamp(5rem,10vw,14rem)] aspect-[3/4] bg-[#1c2342] rounded-xl"
          >
            <div class="grid gap-2 w-full px-2">
              <USkeleton class="h-3 w-[85%] bg-slate-600/50" />
              <USkeleton class="h-3 w-[70%] bg-slate-600/50" />
            </div>
          </div>
        </div>

        <!-- White Card -->
        <div
          class="outline-2 outline-dashed dark:outline-slate-300/20 outline-slate-900/20 outline-offset-3 rounded-xl"
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
            :scale="80"
            @click="whiteCardFlipped = !whiteCardFlipped"
          />
          <div
            v-else
            class="flex items-center p-2 text-white w-[clamp(5rem,10vw,14rem)] aspect-[3/4] bg-[#e7e1de] rounded-xl shadow-[inset_0_0_0_6px_theme(colors.stone.400/50)]"
          >
            <div class="grid gap-2 w-full px-2">
              <USkeleton class="h-3 w-[85%] bg-stone-400/50" />
              <USkeleton class="h-3 w-[70%] bg-stone-400/50" />
            </div>
          </div>
        </div>
      </div>

      <!-- Draw + Speak buttons -->
      <ClientOnly>
        <div class="flex gap-2">
          <UButton
            :loading="isFetching"
            class="font-display tracking-wider cursor-pointer"
            color="neutral"
            icon="i-solar-layers-minimalistic-bold-duotone"
            variant="subtle"
            size="sm"
            @click="fetchNewCards"
          >
            DRAW NEW CARDS
          </UButton>
          <UButton
            class="cursor-pointer"
            color="neutral"
            :icon="
              isSpeaking
                ? 'i-solar-stop-bold'
                : 'i-solar-user-speak-bold-duotone'
            "
            variant="subtle"
            size="sm"
            @click="handleSpeakClick"
          />
        </div>
      </ClientOnly>
    </div>
    <!-- Primary Actions -->
    <div class="flex flex-col items-center gap-3 w-full max-w-xs mb-8">
      <!-- CREATE GAME -->
      <button
        class="w-full py-3 px-6 rounded-xl font-display text-2xl tracking-widest text-white cursor-pointer bg-gradient-to-r from-violet-600 to-indigo-600 shadow-[0_0_24px_rgba(139,92,246,0.45)] hover:shadow-[0_0_36px_rgba(139,92,246,0.65)] hover:brightness-110 active:scale-95 transition-all duration-150"
        @click="checkForActiveLobbyAndCreate"
      >
        CREATE GAME
      </button>

      <!-- JOIN GAME -->
      <button
        class="w-full py-3 px-6 rounded-xl font-display text-2xl tracking-widest text-slate-200 cursor-pointer glass-panel hover:border-violet-500/40 hover:text-white active:scale-95 transition-all duration-150"
        @click="checkForActiveLobbyAndJoin"
      >
        JOIN GAME
      </button>

      <!-- BROWSE LOBBIES -->
      <button
        class="w-full py-3 px-6 rounded-xl font-display text-2xl tracking-widest text-slate-200 cursor-pointer glass-panel hover:border-violet-500/40 hover:text-white active:scale-95 transition-all duration-150"
        @click="navigateTo('/game')"
      >
        BROWSE LOBBIES
      </button>
      <button
        class="w-full py-3 px-6 rounded-xl font-display text-2xl tracking-widest text-slate-200 cursor-pointer glass-panel hover:border-violet-500/40 hover:text-white active:scale-95 transition-all duration-150"
        @click="navigateTo('/labs')"
      >
        LABS
      </button>
      <button
        class="w-full py-3 px-6 rounded-xl font-display text-2xl tracking-widest text-slate-200 cursor-pointer glass-panel hover:border-violet-500/40 hover:text-white active:scale-95 transition-all duration-150"
        @click="navigateTo('/admin')"
      >
        ADMIN
      </button>
    </div>

    <!-- Try Me Panel -->

    <!-- Footer links -->
    <div class="flex gap-6 mt-8 text-sm text-slate-500">
      <NuxtLink to="/about" class="hover:text-slate-300 transition-colors"
        >About</NuxtLink
      >
      <NuxtLink to="/profile" class="hover:text-slate-300 transition-colors"
        >Profile</NuxtLink
      >
      <NuxtLink to="/changelog" class="hover:text-slate-300 transition-colors"
        >Changelog</NuxtLink
      >
    </div>
  </div>
</template>

<script lang="ts" setup>
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
import { SFX } from "~/config/sfx.config";
import { useLobbyActions } from "~/composables/useLobbyActions";
import { isAuthenticatedUser } from "~/composables/useUserUtils";
import { useNotifications } from "~/composables/useNotifications";
import { useIsAdmin } from "~/composables/useAdminCheck";

type TTSProvider = "browser" | "elevenlabs" | "openai";

const { t } = useI18n();
const userPrefs = useUserPrefsStore();
const userStore = useUserStore();
const { notify } = useNotifications();
const { isDiscordActivity } = useDiscordSDK();
const isAdmin = useIsAdmin();
const router = useRouter();
const route = useRoute();

const avatarUrl = computed(() => {
  const user = userStore.user;
  if (!user?.prefs) return null;
  if (user.prefs.avatarUrl) return user.prefs.avatarUrl;
  if (user.prefs.discordUserId && user.prefs.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.prefs.discordUserId}/${user.prefs.avatar}.png`;
  }
  if (user.name) {
    return `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(user.name)}`;
  }
  return null;
});

const handleLoginWithDiscord = async (): Promise<void> => {
  try {
    await userStore.loginWithDiscord();
  } catch (err: any) {
    console.error("Login error:", err);
    notify({ title: t("notification.login_failed"), color: "error" });
  }
};

const handleLogout = async () => {
  try {
    await userStore.logout();
    notify({ title: t("notification.logged_out"), color: "success" });
  } catch (err) {
    notify({ title: t("notification.logout_failed"), color: "error" });
    console.error("Logout error:", err);
  }
};

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
const isFetching = ref(false);

const { checkForActiveLobbyAndCreate, checkForActiveLobbyAndJoin } =
  useLobbyActions();

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
  speak: (provider: TTSProvider, text: string) => {},
  stop: () => {},
  isSpeaking: ref(false),
};

if (typeof window !== "undefined") {
  speechService = useSpeech({
    elevenLabsVoiceId: elevenLabsConfig.apiVoice,
    openAIVoice: openAIConfig.apiVoice,
  });
}

const isClient = computed(() => typeof window !== "undefined");

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
  if (isSpeaking.value) {
    speechService.stop();
    return;
  }
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

const { vibrate } = useVibrate({ pattern: [10, 7, 5], interval: 0 });

useHead({
  title: "Unfit for Print",
});

const fetchNewCards = async () => {
  if (isFetching.value) return;
  isFetching.value = true;

  whiteCardFlipped.value = true;
  blackCardFlipped.value = true;

  if (isClient.value) {
    await playSfx(SFX.cardThrow, { pitch: [0.8, 1.2], volume: 0.75 });
  }

  setTimeout(async () => {
    if (isClient.value) {
      vibrate();
    }

    const [black, white] = await Promise.all([
      fetchRandomCard("black", 1),
      fetchRandomCard("white"),
    ]);

    blackCard.value = black;
    randomCard.value = black;
    blackCardFlipped.value = false;

    whiteCard.value = white;
    whiteCardFlipped.value = false;

    setTimeout(() => {
      isFetching.value = false;
    }, 1250);
  });
};

onMounted(() => {
  fetchNewCards();
});
</script>
