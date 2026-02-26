<!-- components/AppHeader.vue -->
<script lang="ts" setup>
import { useUserStore } from "~/stores/userStore";
import { isAuthenticatedUser } from "~/composables/useUserUtils";
import { useNotifications } from "~/composables/useNotifications";
import { ref, watch } from "vue";
import { useRouter, useRoute } from "#vue-router";
import { useLobby } from "~/composables/useLobby";
import { useUiStore } from "~/stores/uiStore";
import { useI18n } from "vue-i18n";
import { useIsAdmin } from "~/composables/useAdminCheck";

const { getActiveLobbyForUser } = useLobby();
const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const uiStore = useUiStore();
const { notify } = useNotifications();
const isMobileMenuOpen = ref(false);
const showJoin = ref(false);
const showCreate = ref(false);
const isJoining = ref(false);
const isCreating = ref(false);
const { t } = useI18n();

watch(
  () => route.path,
  () => {
    if (isMobileMenuOpen.value) {
      isMobileMenuOpen.value = false;
    }
  },
);
let touchStartX = 0;
let touchEndX = 0;

function handleTouchStart(e: TouchEvent) {
  touchStartX = e.changedTouches[0]?.screenX ?? touchStartX;
}

function handleTouchEnd(e: TouchEvent) {
  touchEndX = e.changedTouches[0]?.screenX ?? touchEndX;
  handleGesture();
}

function handleGesture() {
  const deltaX = touchEndX - touchStartX;
  if (deltaX > 50) {
    isMobileMenuOpen.value = false;
  }
}

const handleLoginWithDiscord = async (): Promise<void> => {
  try {
    // Navigates to server-side OAuth handler — page will redirect
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

const avatarUrl = computed(() => {
  const user = userStore.user;
  if (!user?.prefs) return null;

  // Prefer the full CDN URL persisted during OAuth callback / session fetch
  if (user.prefs.avatarUrl) {
    return user.prefs.avatarUrl;
  }

  // Legacy fallback: reconstruct from hash if avatarUrl wasn't persisted yet
  if (user.prefs.discordUserId && user.prefs.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.prefs.discordUserId}/${user.prefs.avatar}.png`;
  }

  // Anonymous users: generate a fun DiceBear avatar from their name
  if (user.name) {
    return `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(user.name)}`;
  }

  return null;
});

const checkForActiveLobbyAndJoin = async () => {
  try {
    isJoining.value = true;

    if (userStore.user) {
      const activeLobby = await getActiveLobbyForUser(userStore.user.$id);
      if (activeLobby) {
        notify({
          title: t("notification.redirecting"),
          color: "info",
          icon: "i-mdi-controller",
          duration: 2000,
        });
        await router.push(`/game/${activeLobby.code}`);
        return;
      }
    }

    showJoin.value = true;
  } catch (error: unknown) {
    console.error("Error checking for active lobby:", error);
    showJoin.value = true;
  } finally {
    isJoining.value = false;
  }
};

const checkForActiveLobbyAndCreate = async () => {
  try {
    isCreating.value = true;

    if (!userStore.user) {
      showCreate.value = true;
      return;
    }

    // Log runtime configuration for debugging
    const config = useRuntimeConfig();
    console.log("Runtime configuration before creating lobby:", {
      databaseId: config.public.appwriteDatabaseId,
      lobbyCollectionId: config.public.appwriteLobbyCollectionId,
      playerCollectionId: config.public.appwritePlayerCollectionId,
    });

    const activeLobby = await getActiveLobbyForUser(userStore.user.$id);
    if (activeLobby) {
      notify({
        title: t("notification.redirecting"),
        color: "info",
        icon: "i-mdi-controller",
        duration: 2000,
      });
      await router.push(`/game/${activeLobby.code}`);
    } else {
      showCreate.value = true;
    }
  } catch (error: unknown) {
    // Check if it's an AppwriteException with collection not found error
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === 404 &&
      error.message?.includes(
        "Collection with the requested ID could not be found",
      )
    ) {
      console.warn("Collections not initialized, showing create dialog");
      showCreate.value = true;
      return;
    }

    console.error("Error checking for active lobby:", error);
    showCreate.value = true;
  } finally {
    isCreating.value = false;
  }
};

const handleJoined = (code: string) => {
  notify({
    title: t("notification.loading_game"),
    color: "info",
    icon: "i-mdi-loading i-spin",
    duration: 3000,
  });
  router.push(`/game/${code}`);
};

const openPolicyModal = () => {
  isMobileMenuOpen.value = false;
  uiStore.togglePolicyModal(true);
};
const isAdmin = useIsAdmin();
</script>

<template class="">
  <header
    class="fixed top-0 left-0 right-0 z-50 flex w-full h-16 items-center p-4 backdrop-blur-2xl dark:bg-slate-900/50 bg-slate-200 shadow-md text-2xl font-medium border-b-2 border-slate-700/50 transition-all duration-250 linear"
  >
    <!-- Mobile Menu Button -->
    <UButton
      class="lg:hidden absolute right-4 p-4"
      color="neutral"
      icon="i-solar-hamburger-menu-broken"
      size="xl"
      variant="subtle"
      @click="isMobileMenuOpen = true"
    />

    <!-- Mobile Join/Create Buttons -->
    <ClientOnly>
      <UFieldGroup
        class="lg:hidden absolute left-1/2 transform -translate-x-1/2 flex items-center gap-1"
      >
        <UButton
          :loading="isJoining"
          aria-label="Join Game"
          class="text-xl p-2 outline-1 dark:outline-none"
          color="success"
          icon="i-solar-hand-shake-line-duotone"
          label="Join Game"
          size="lg"
          variant="soft"
          @click="checkForActiveLobbyAndJoin"
        />
        <UButton
          :disabled="!isAuthenticatedUser(userStore.user)"
          :label="
            isAuthenticatedUser(userStore.user)
              ? 'Create Game'
              : 'Login to Create'
          "
          :loading="isCreating"
          aria-label="Create Game"
          class="text-xl p-2 outline-1 dark:outline-none"
          color="warning"
          icon="i-solar-magic-stick-3-bold-duotone"
          size="lg"
          variant="soft"
          @click="checkForActiveLobbyAndCreate"
        />
      </UFieldGroup>
    </ClientOnly>

    <div class="flex-1 flex">
      <ClientOnly>
        <NuxtLink class="cursor-pointer" to="/">
          <img
            alt="Unfit For Print Logo"
            class="mx-auto w-10 h-auto"
            src="/img/ufp2.svg"
          />
        </NuxtLink>
      </ClientOnly>
    </div>
    <ClientOnly>
      <nav
        class="flex items-center gap-2 justify-end not-lg:hidden ml-auto align-middle"
      >
        <ClientOnly>
          <UButton
            class="text-xl py-2 px-4 cursor-pointer outline-1 dark:outline-none"
            color="info"
            icon="i-solar-home-smile-bold-duotone"
            size="xl"
            to="/"
            variant="subtle"
            >{{ t("nav.home") }}
          </UButton>
        </ClientOnly>
        <UFieldGroup>
          <UButton
            :loading="isJoining"
            class="text-xl py-2 px-4 cursor-pointer outline-1 dark:outline-none"
            color="success"
            icon="i-solar-hand-shake-line-duotone"
            variant="subtle"
            @click="checkForActiveLobbyAndJoin"
          >
            {{ t("nav.joingame") }}
          </UButton>
          <UButton
            :disabled="!isAuthenticatedUser(userStore.user)"
            :icon="
              !isAuthenticatedUser(userStore.user)
                ? 'i-solar-double-alt-arrow-right-bold-duotone'
                : 'i-solar-magic-stick-3-bold-duotone'
            "
            :loading="isCreating"
            class="text-xl py-2 px-4 cursor-pointer outline-1 dark:outline-none"
            color="warning"
            variant="subtle"
            @click="checkForActiveLobbyAndCreate"
          >
            {{
              isAuthenticatedUser(userStore.user)
                ? t("nav.creategame")
                : t("nav.login_to_create")
            }}
          </UButton>
        </UFieldGroup>
        <ClientOnly>
          <UButton
            class="text-xl py-2 px-4 cursor-pointer outline-1 dark:outline-none"
            color="warning"
            icon="i-solar-gamepad-bold-duotone"
            to="/game"
            variant="subtle"
            >{{ t("nav.games") }}
          </UButton>
        </ClientOnly>
        <ClientOnly v-if="isAuthenticatedUser(userStore.user)">
          <UButton
            class="text-xl py-2 px-4 cursor-pointer outline-1 dark:outline-none"
            color="primary"
            icon="i-solar-card-bold-duotone"
            to="/labs"
            variant="subtle"
            >{{ t("nav.labs") }}
          </UButton>
        </ClientOnly>
        <div
          v-if="isAuthenticatedUser(userStore.user)"
          class="flex items-center gap-2 justify-end not-lg:hidden ml-auto align-middle"
        >
          <ClientOnly>
            <UButton
              v-if="isAdmin"
              class="text-xl py-2 px-4 cursor-pointer outline-1 dark:outline-none"
              color="error"
              icon="i-solar-shield-star-bold-duotone"
              to="/admin"
              variant="subtle"
              >{{ t("nav.admin") }}
            </UButton>
          </ClientOnly>
          <!--					<ClientOnly>-->
          <!--						<UButton class="text-xl py-2 px-4 cursor-pointer outline-1 dark:outline-none" color="secondary"-->
          <!--						         icon="i-solar-user-id-bold-duotone" to="/profile"-->
          <!--						         variant="subtle">{{ t('nav.profile') }}-->
          <!--						</UButton>-->
          <!--					</ClientOnly>-->
          <UButton
            class="text-xl py-2 px-4 cursor-pointer outline-1 dark:outline-none"
            color="error"
            icon="i-solar-logout-3-bold-duotone"
            variant="subtle"
            @click="handleLogout"
            >{{ t("nav.logout") }}
          </UButton>
        </div>

        <template v-else>
          <UButton
            class="text-xl py-2 px-4 cursor-pointer outline-1 dark:outline-none"
            color="secondary"
            icon="i-logos-discord-icon"
            variant="subtle"
            @click="handleLoginWithDiscord"
            >{{ t("nav.login_discord") }}
          </UButton>
        </template>
      </nav>
    </ClientOnly>
  </header>

  <!-- Mobile Navigation Slideover -->
  <ClientOnly>
    <USlideover
      v-model:open="isMobileMenuOpen"
      class="lg:hidden h-full"
      description="Contains links to important sections of the app."
      title="Mobile Navigation Menu"
    >
      <template #content>
        <div
          class="flex flex-col h-full"
          @touchend="handleTouchEnd"
          @touchstart="handleTouchStart"
        >
          <!-- Sticky Welcome Section -->
          <div
            class="sticky top-0 z-10 bg-slate-200 dark:bg-slate-900 p-3 border-b-2 border-slate-700/25"
          >
            <div class="flex items-center justify-between gap-2">
              <!-- Avatar + Welcome Message -->
              <div class="flex items-center gap-2">
                <img
                  v-if="avatarUrl"
                  :src="avatarUrl"
                  alt="avatar"
                  class="w-10 h-10 rounded-full"
                />
                <span
                  v-if="isAuthenticatedUser(userStore.user)"
                  class="text-xl"
                >
                  {{
                    t("nav.welcome_user", {
                      name: userStore.user.name.toUpperCase(),
                    })
                  }}
                </span>
                <span v-else class="text-xl">{{ t("nav.welcome_guest") }}</span>
              </div>

              <!-- Close Button Aligned Right -->
              <UButton
                class="lg:hidden absolute right-4 p-4"
                color="neutral"
                icon="i-solar-close-square-outline"
                size="xl"
                variant="subtle"
                @click="isMobileMenuOpen = false"
              />
            </div>
          </div>

          <!-- Scrollable Nav Section -->
          <div
            class="flex-1 overflow-y-auto flex flex-col p-4 bg-slate-100 dark:bg-slate-900"
          >
            <ClientOnly>
              <UButton
                block
                class="mb-2 text-xl py-3 border-2 dark:border-none"
                color="info"
                icon="i-solar-home-smile-bold-duotone"
                size="xl"
                to="/"
                variant="soft"
              >
                {{ t("nav.home") }}
              </UButton>
            </ClientOnly>
            <UButton
              :loading="isJoining"
              block
              class="mb-2 text-xl py-3 border-2 dark:border-none"
              color="success"
              icon="i-solar-hand-shake-line-duotone"
              size="xl"
              variant="soft"
              @click="checkForActiveLobbyAndJoin"
            >
              {{ t("nav.joingame") }}
            </UButton>
            <UButton
              :disabled="!isAuthenticatedUser(userStore.user)"
              :icon="
                !isAuthenticatedUser(userStore.user)
                  ? 'i-solar-double-alt-arrow-down-bold-duotone'
                  : 'i-solar-magic-stick-3-bold-duotone'
              "
              :loading="isCreating"
              block
              class="mb-2 text-xl py-3 border-2 dark:border-none"
              color="warning"
              size="xl"
              variant="soft"
              @click="checkForActiveLobbyAndCreate"
            >
              {{
                isAuthenticatedUser(userStore.user)
                  ? t("nav.creategame")
                  : t("nav.login_to_create")
              }}
            </UButton>

            <template v-if="isAuthenticatedUser(userStore.user)">
              <ClientOnly>
                <UButton
                  v-if="isAdmin"
                  block
                  class="mb-2 text-xl py-3 border-2 dark:border-none"
                  color="error"
                  icon="i-solar-shield-star-bold-duotone"
                  to="/admin"
                  variant="soft"
                >
                  {{ t("nav.admin") }}
                </UButton>
              </ClientOnly>
              <!--							<ClientOnly>-->
              <!--								<UButton block class="mb-2 text-xl py-3 border-2 dark:border-none" color="secondary"-->
              <!--								         icon="i-solar-user-id-bold-duotone" to="/profile"-->
              <!--								         variant="soft">-->
              <!--									{{ t('nav.profile') }}-->
              <!--								</UButton>-->
              <!--							</ClientOnly>-->
              <ClientOnly>
                <UButton
                  block
                  class="mb-2 text-xl py-3 border-2 dark:border-none"
                  color="warning"
                  icon="i-solar-gamepad-bold-duotone"
                  to="/game"
                  variant="soft"
                >
                  {{ t("nav.games") }}
                </UButton>
              </ClientOnly>
              <ClientOnly v-if="isAuthenticatedUser(userStore.user)">
                <UButton
                  block
                  class="mb-2 text-xl py-3 border-2 dark:border-none"
                  color="primary"
                  icon="i-solar-card-bold-duotone"
                  to="/labs"
                  variant="soft"
                  >{{ t("nav.labs") }}
                </UButton>
              </ClientOnly>
              <UButton
                block
                class="mb-2 text-xl py-3 border-2 dark:border-none"
                color="error"
                icon="i-solar-logout-3-bold-duotone"
                variant="soft"
                @click="handleLogout"
              >
                {{ t("nav.logout") }}
              </UButton>
            </template>

            <template v-else>
              <USeparator class="my-2" />
              <UButton
                block
                class="mb-2 text-xl py-3 border-2 dark:border-none"
                color="secondary"
                icon="i-logos-discord-icon"
                variant="soft"
                @click="handleLoginWithDiscord"
              >
                {{ t("nav.login_discord") }}
              </UButton>
            </template>

            <!-- Footer section always last in scroll -->
            <div
              class="mt-auto flex flex-col items-center justify-center gap-2 pt-4"
            >
              <USeparator class="my-2" />
              <UButton
                block
                class="mb-2 text-sm py-3 border-2 dark:border-none"
                color="secondary"
                icon="i-solar-shield-check-line-duotone"
                variant="soft"
                @click="openPolicyModal"
              >
                {{ t("nav.privacy_policy") }}
              </UButton>
              <p class="text-xs">{{ t("footer.copyright") }}</p>
              <p class="text-xs">Made with ❤️ by MYND @ PPO.GG</p>
              <ClientOnly>
                <NuxtLink
                  class="cursor-pointer"
                  target="_blank"
                  to="https://github.com/PPO-GG/unfit-for-print"
                >
                  <img
                    alt="GitHub package.json version"
                    class="w-12 bg-slate-600 rounded-md"
                    src="https://img.shields.io/github/package-json/v/PPO-GG/unfit-for-print?style=flat-square&logo=github&label=%20&labelColor=rgba(0%2C0%2C0%2C0)&color=rgba(0%2C0%2C0%2C0)"
                  />
                </NuxtLink>
              </ClientOnly>
              <div
                class="w-full flex flex-row gap-2 mt-4 items-center justify-center"
              >
                <LanguageSwitcher />
                <VoiceSwitcher />
                <ThemeSwitcher />
              </div>
            </div>
          </div>
        </div>
      </template>
    </USlideover>
  </ClientOnly>

  <!-- Modals (shared between mobile and desktop) -->
  <UModal v-model:open="showJoin" :title="t('modal.join_lobby')">
    <template #body>
      <JoinLobbyForm @joined="handleJoined" />
    </template>
  </UModal>

  <UModal v-model:open="showCreate" :title="t('modal.create_lobby')">
    <template #body>
      <CreateLobbyDialog @created="handleJoined" />
    </template>
  </UModal>
</template>
