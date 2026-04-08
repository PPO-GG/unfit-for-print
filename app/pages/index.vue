<template>
  <div
    class="min-h-screen flex flex-col items-center justify-center px-4 py-8 select-none"
  >
    <!-- Avatar / User Menu (top-right corner) -->
    <ClientOnly>
      <div class="fixed top-4 right-4 z-20 scale-125 origin-top-right">
        <template v-if="isAuthenticatedUser(userStore.user)">
          <div
            ref="userMenuRef"
            class="user-menu-container"
            :class="{ 'is-open': userMenuOpen }"
            @mouseleave="userMenuOpen = false"
          >
            <!-- Header row: avatar + name + chevron -->
            <button
              class="user-menu-trigger"
              type="button"
              @click="userMenuOpen = !userMenuOpen"
            >
              <AvatarDecoration
                :decoration-id="userStore.user?.prefs?.activeDecoration"
              >
                <img
                  v-if="avatarUrl"
                  :src="avatarUrl"
                  :alt="userStore.user.name"
                  class="user-menu-avatar"
                />
                <UAvatar
                  v-else
                  :alt="userStore.user?.name ?? 'Profile'"
                  size="md"
                  class="user-menu-avatar"
                />
              </AvatarDecoration>
              <span class="user-menu-name">
                {{ userStore.user.name }}
              </span>
              <UIcon
                name="i-solar-alt-arrow-down-line-duotone"
                class="user-menu-chevron"
              />
            </button>

            <!-- Expandable menu items -->
            <div class="user-menu-items">
              <NuxtLink
                to="/profile"
                class="user-menu-item rounded-md"
                @click="userMenuOpen = false"
              >
                <UIcon
                  name="i-solar-user-id-bold-duotone"
                  class="user-menu-item-icon"
                />
                <span>{{ t("nav.profile") }}</span>
              </NuxtLink>
              <NuxtLink
                to="/profile#settings"
                class="user-menu-item rounded-md"
                @click="userMenuOpen = false"
              >
                <UIcon
                  name="i-solar-settings-bold-duotone"
                  class="user-menu-item-icon"
                />
                <span>{{ t("nav.settings") }}</span>
              </NuxtLink>
              <button
                class="user-menu-item user-menu-item--danger rounded-b-2xl rounded-t-md"
                @click="
                  handleLogout();
                  userMenuOpen = false;
                "
              >
                <UIcon
                  name="i-solar-logout-3-bold-duotone"
                  class="user-menu-item-icon"
                />
                <span>{{ t("nav.logout") }}</span>
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <UButton
            color="secondary"
            variant="subtle"
            icon="i-logos-discord-icon"
            size="sm"
            class="outline-1 dark:outline-none backdrop-blur-2xl"
            @click="handleLoginWithDiscord"
          >
            {{ t("nav.login_discord") }}
          </UButton>
        </template>
      </div>
    </ClientOnly>

    <!-- Logo -->
    <div class="flex flex-col items-center mb-8 -mt-24 pointer-events-none">
      <img
        src="/img/ufp2.svg"
        alt="Unfit For Print Logo"
        class="w-12 sm:w-20 md:w-24 h-auto drop-shadow-xl"
      />
    </div>

    <div
      class="bg-slate-700/20 backdrop-blur-md outline-2 outline-offset-2 dark:outline-slate-500/20 outline-slate-900/20 rounded-2xl p-4 flex flex-col items-center gap-4 mb-4 w-full max-w-md"
    >
      <div class="flex justify-center gap-4">
        <!-- Black Card -->
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
          :scale="75"
          @click="blackCardFlipped = !blackCardFlipped"
        />
        <div
          v-else
          class="flex items-center p-2 text-white w-[clamp(calc(10rem*0.75),calc(12vw*0.75),calc(18rem*0.75))] aspect-[3/4] bg-[#1c2342] rounded-xl"
        >
          <div class="grid gap-2 w-full px-2">
            <USkeleton class="h-3 w-[85%] bg-slate-600/50" />
            <USkeleton class="h-3 w-[70%] bg-slate-600/50" />
          </div>
        </div>

        <!-- White Card -->
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
          :scale="75"
          @click="whiteCardFlipped = !whiteCardFlipped"
        />
        <div
          v-else
          class="flex items-center p-2 text-white w-[clamp(calc(10rem*0.75),calc(12vw*0.75),calc(18rem*0.75))] aspect-[3/4] bg-[#e7e1de] rounded-xl shadow-[inset_0_0_0_6px_theme(colors.stone.400/50)]"
        >
          <div class="grid gap-2 w-full px-2">
            <USkeleton class="h-3 w-[85%] bg-stone-400/50" />
            <USkeleton class="h-3 w-[70%] bg-stone-400/50" />
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
            size="lg"
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
            size="lg"
            @click="handleSpeakClick"
          />
        </div>
      </ClientOnly>
    </div>
    <!-- Primary Actions -->
    <ClientOnly>
      <div class="flex flex-col items-center gap-1 w-full max-w-md mb-8">
        <UButton
          v-if="!isDiscordActivity"
          block
          :loading="isCreating"
          :disabled="!isAuthenticatedUser(userStore.user)"
          class="text-2xl p-4 cursor-pointer outline-1 dark:outline-none backdrop-blur-2xl w-full hover:scale-x-105 transition-all hover:ring-2 hover:ring-warning-500"
          color="warning"
          icon="i-solar-add-square-bold-duotone"
          variant="subtle"
          @click="checkForActiveLobbyAndCreate"
        >
          {{ t("nav.creategame") }}
        </UButton>

        <UButton
          v-if="!isDiscordActivity"
          block
          :loading="isJoining"
          class="text-2xl p-4 cursor-pointer outline-1 dark:outline-none backdrop-blur-2xl w-full hover:scale-x-105 transition-all hover:ring-2 hover:ring-success-500"
          color="success"
          icon="i-solar-hand-shake-line-duotone"
          variant="subtle"
          @click="checkForActiveLobbyAndJoin"
        >
          {{ t("nav.joingame") }}
        </UButton>

        <UButton
          v-if="!isDiscordActivity"
          block
          class="text-2xl p-4 cursor-pointer outline-1 dark:outline-none backdrop-blur-2xl w-full hover:scale-x-105 transition-all hover:ring-2 hover:ring-info-500"
          color="info"
          icon="i-solar-gamepad-bold-duotone"
          variant="subtle"
          to="/game"
        >
          {{ t("nav.games") }}
        </UButton>

        <UButton
          block
          class="text-2xl p-4 cursor-pointer outline-1 dark:outline-none backdrop-blur-2xl w-full hover:scale-x-105 transition-all hover:ring-2 hover:ring-primary-500"
          color="primary"
          icon="i-solar-test-tube-bold-duotone"
          variant="subtle"
          to="/labs"
        >
          {{ t("nav.labs") }}
        </UButton>

        <!-- Admin: only shown to admins -->
        <UButton
          v-if="isAdmin"
          block
          class="text-2xl p-4 cursor-pointer outline-1 dark:outline-none backdrop-blur-2xl w-full hover:scale-x-105 transition-all hover:ring-2 hover:ring-error-500"
          color="error"
          icon="i-solar-shield-star-bold-duotone"
          variant="subtle"
          to="/admin"
        >
          {{ t("nav.admin") }}
        </UButton>

        <!-- Hub: only shown in Discord Activity mode -->
        <UButton
          v-if="isDiscordActivity"
          block
          class="text-2xl p-4 cursor-pointer outline-1 dark:outline-none backdrop-blur-2xl w-full hover:scale-x-105 transition-all hover:ring-2 hover:ring-warning-500"
          color="warning"
          icon="i-ic-baseline-discord"
          variant="subtle"
          to="/activity/hub"
        >
          {{ t("nav.hub") }}
        </UButton>
      </div>
    </ClientOnly>

    <!-- Try Me Panel -->

    <!-- Footer links -->
    <div class="flex gap-6 mt-8 text-sm text-slate-500 absolute bottom-4">
      <NuxtLink to="/about" class="hover:text-slate-300 transition-colors"
        >About</NuxtLink
      >
      <NuxtLink to="/profile" class="hover:text-slate-300 transition-colors"
        >Profile</NuxtLink
      >
      <NuxtLink to="/changelog" class="hover:text-slate-300 transition-colors"
        >Changelog</NuxtLink
      >

      <NuxtLink
        to="/legal/termsofservice"
        class="hover:text-slate-300 transition-colors"
        >Terms</NuxtLink
      >

      <NuxtLink
        to="/legal/privacypolicy"
        class="hover:text-slate-300 transition-colors"
        >Privacy</NuxtLink
      >
    </div>

    <UModal v-model:open="showJoin" :title="t('modal.join_lobby')">
      <template #body>
        <JoinLobbyForm @joined="handleJoined" />
      </template>
    </UModal>
  </div>
</template>

<script lang="ts" setup>
import { useCards } from "~/composables/useCards";
import { useVibrate, onClickOutside } from "@vueuse/core";
import { useSpeech } from "~/composables/useSpeech";
import { mergeCardText } from "~/composables/useMergeCards";
import { useI18n } from "vue-i18n";
import { useUserPrefsStore } from "@/stores/userPrefsStore";
import {
  TTS_PROVIDERS,
  getProviderFromVoiceId,
  type TTSProviderType,
} from "~/constants/ttsProviders";
import { useUserStore } from "~/stores/userStore";
import { SFX } from "~/config/sfx.config";
import { useLobbyActions } from "~/composables/useLobbyActions";
import { isAuthenticatedUser } from "~/composables/useUserUtils";
import { useNotifications } from "~/composables/useNotifications";
import { useIsAdmin } from "~/composables/useAdminCheck";

const { t } = useI18n();
const userPrefs = useUserPrefsStore();
const userStore = useUserStore();
const { notify } = useNotifications();
const { isDiscordActivity } = useDiscordSDK();
const isAdmin = useIsAdmin();
const router = useRouter();
const route = useRoute();

// ─── User Menu ───────────────────────────────────────────────────────
const userMenuOpen = ref(false);
const userMenuRef = ref<HTMLElement | null>(null);
onClickOutside(userMenuRef, () => {
  userMenuOpen.value = false;
});

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

const {
  checkForActiveLobbyAndCreate,
  checkForActiveLobbyAndJoin,
  isJoining,
  isCreating,
  showJoin,
  handleJoined,
} = useLobbyActions();

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
  speak: (provider: TTSProviderType, text: string) => {},
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
  (): TTSProviderType => getProviderFromVoiceId(userPrefs.ttsVoice),
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

<style scoped>
/* ─── Container ─────────────────────────────────────────────────────── */

.user-menu-container {
  display: flex;
  flex-direction: column;
  border-radius: 1.5rem;
  background: rgba(30, 27, 51, 0.55);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(139, 92, 246, 0.25);
  overflow: hidden;
  transition:
    background 0.25s ease,
    border-color 0.25s ease,
    box-shadow 0.3s ease;
}

.user-menu-container:hover {
  border-color: rgba(139, 92, 246, 0.45);
  box-shadow:
    0 0 0 1px rgba(139, 92, 246, 0.1),
    0 4px 20px rgba(139, 92, 246, 0.1);
}

.user-menu-container.is-open {
  background: rgba(30, 27, 51, 0.8);
  border-color: rgba(139, 92, 246, 0.5);
  box-shadow:
    0 0 0 1px rgba(139, 92, 246, 0.15),
    0 8px 32px rgba(139, 92, 246, 0.15);
}

/* ─── Trigger Row ───────────────────────────────────────────────────── */

.user-menu-trigger {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 3px;
  cursor: pointer;
  outline: none;
  background: none;
  border: none;
  white-space: nowrap;
  transition:
    gap 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    padding-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.user-menu-container:hover .user-menu-trigger,
.user-menu-container.is-open .user-menu-trigger {
  gap: 8px;
  padding-right: 12px;
}

/* ─── Avatar ────────────────────────────────────────────────────────── */

.user-menu-trigger :deep(.user-menu-avatar) {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.4);
  flex-shrink: 0;
  transition: box-shadow 0.25s ease;
}

.user-menu-container:hover :deep(.user-menu-avatar),
.user-menu-container.is-open :deep(.user-menu-avatar) {
  box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.7);
}

/* ─── Username ──────────────────────────────────────────────────────── */

.user-menu-name {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgba(226, 222, 255, 0.9);
  letter-spacing: 0.01em;
  transition:
    max-width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.25s ease 0.08s;
}

.user-menu-container:hover .user-menu-name,
.user-menu-container.is-open .user-menu-name {
  max-width: 10rem;
  opacity: 1;
}

/* ─── Chevron ───────────────────────────────────────────────────────── */

.user-menu-trigger :deep(.user-menu-chevron) {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: rgba(167, 139, 250, 0.6);
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  transition:
    max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.2s ease 0.1s,
    transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.user-menu-container:hover :deep(.user-menu-chevron),
.user-menu-container.is-open :deep(.user-menu-chevron) {
  max-width: 1rem;
  opacity: 1;
}

.user-menu-container.is-open :deep(.user-menu-chevron) {
  transform: rotate(180deg);
}

/* ─── Expandable Items Panel ────────────────────────────────────────── */

.user-menu-items {
  display: flex;
  flex-direction: column;
  max-height: 0;
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  transition:
    max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    max-width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.25s ease,
    padding 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0;
}

.user-menu-container.is-open .user-menu-items {
  max-height: 12rem;
  max-width: 15rem;
  opacity: 1;
  padding: 4px 6px 6px;
}

/* ─── Separator ─────────────────────────────────────────────────────── */

.user-menu-separator {
  height: 1px;
  margin: 3px 8px;
  background: rgba(139, 92, 246, 0.2);
}

/* ─── Menu Item ─────────────────────────────────────────────────────── */

.user-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgba(226, 222, 255, 0.85);
  text-decoration: none;
  border: none;
  background: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.user-menu-item:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.15);
  color: rgba(245, 243, 255, 1);
}

.user-menu-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.user-menu-item--danger {
  color: rgba(248, 113, 113, 0.85);
}

.user-menu-item--danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.15);
  color: rgba(252, 165, 165, 1);
}

.user-menu-item :deep(.user-menu-item-icon) {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
}
</style>
