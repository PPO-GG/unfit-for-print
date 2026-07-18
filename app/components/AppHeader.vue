<!-- components/AppHeader.vue -->
<script lang="ts" setup>
import { onClickOutside } from "@vueuse/core";
import { useUserStore } from "~/stores/userStore";
import { isAuthenticatedUser } from "~/composables/useUserUtils";
import { useNotifications } from "~/composables/useNotifications";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "#vue-router";
import { useUiStore } from "~/stores/uiStore";
import { useI18n } from "vue-i18n";
import { useIsAdmin } from "~/composables/useAdminCheck";
import { useLobbyActions } from "~/composables/useLobbyActions";

const route = useRoute();
const router = useRouter();
const { isDiscordActivity, close: closeActivity } = useDiscordSDK();
const userStore = useUserStore();
const uiStore = useUiStore();
const { notify } = useNotifications();
const isMobileMenuOpen = ref(false);
const { t } = useI18n();
const { stats } = useBrandPlayerStats();
const { open: settingsOpen, openDrawer } = useBrandSettings();

const profileMenuOpen = ref(false);
const profileMenuRef = ref<HTMLElement | null>(null);
onClickOutside(profileMenuRef, () => (profileMenuOpen.value = false));

const initials = computed<string>(() => {
  const name = userStore.user?.name ?? "UP";
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
});

const handle = computed<string>(() => {
  const u = userStore.user;
  if (u?.prefs?.discordUserId) return `@${u.name} · via Discord`;
  if (u?.name) return `@${u.name}`;
  return "guest";
});

const fallbackGradient = {
  background: "linear-gradient(135deg, #5865f2 0%, #8a4af3 100%)",
} as const;

function onOpenSettings() {
  profileMenuOpen.value = false;
  openDrawer();
}

function onProfileLogout() {
  profileMenuOpen.value = false;
  void handleLogout();
}

// Comma-key shortcut to toggle settings drawer (matches design prototype).
function onSettingsKey(e: KeyboardEvent) {
  if (e.key !== ",") return;
  const target = e.target as HTMLElement | null;
  if (target && target.closest("input,textarea,select,[contenteditable='true']")) return;
  profileMenuOpen.value = false;
  settingsOpen.value = !settingsOpen.value;
}

onMounted(() => window.addEventListener("keydown", onSettingsKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onSettingsKey));

const {
  isJoining,
  isCreating,
  showJoin,
  checkForActiveLobbyAndJoin,
  checkForActiveLobbyAndCreate,
  handleJoined,
} = useLobbyActions();

const navItems = computed(() => [
  {
    labelKey: "nav.home",
    to: "/",
    icon: "i-solar-home-smile-bold-duotone",
    color: "info" as const,
  },
  {
    labelKey: "nav.about",
    to: "/about",
    icon: "i-solar-info-square-bold-duotone",
    color: "info" as const,
  },
  isDiscordActivity.value
    ? {
        labelKey: "nav.hub",
        to: "/activity/hub",
        icon: "i-ic-baseline-discord",
        color: "warning" as const,
      }
    : {
        labelKey: "nav.games",
        to: "/game",
        icon: "i-solar-gamepad-bold-duotone",
        color: "warning" as const,
      },
  {
    labelKey: "nav.labs",
    to: "/labs",
    icon: "i-solar-test-tube-bold-duotone",
    color: "primary" as const,
    authRequired: true,
  },
  {
    labelKey: "nav.profile",
    to: "/profile",
    icon: "i-solar-user-bold-duotone",
    color: "secondary" as const,
    authRequired: true,
  },
]);

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

const openPolicyModal = () => {
  isMobileMenuOpen.value = false;
  uiStore.togglePolicyModal(true);
};
const isAdmin = useIsAdmin();
</script>

<template class="">
  <header
    class="fixed top-0 left-0 right-0 z-50 flex w-full h-16 items-center p-4"
  >
    <!-- Back Button (desktop only, all pages except home and game room) -->
    <UButton
      v-if="route.path !== '/' && !route.path.startsWith('/game/')"
      class="text-xl py-2 px-4 cursor-pointer outline-1 dark:outline-none backdrop-blur-2xl"
      color="neutral"
      icon="i-solar-alt-arrow-left-bold-duotone"
      size="xl"
      variant="subtle"
      @click="router.back()"
    />

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
        v-if="!isDiscordActivity"
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
          icon="i-solar-add-square-bold-duotone"
          size="lg"
          variant="soft"
          @click="checkForActiveLobbyAndCreate"
        />
      </UFieldGroup>
    </ClientOnly>

    <ClientOnly>
      <nav
        class="flex items-center gap-2 justify-end not-lg:hidden ml-auto align-middle"
      >
        <UFieldGroup>
          <ClientOnly>
            <template v-for="item in navItems" :key="item.to">
              <UButton
                v-if="!item.authRequired || isAuthenticatedUser(userStore.user)"
                :color="item.color"
                :icon="item.icon"
                :to="item.to"
                class="text-xl py-2 px-4 cursor-pointer outline-1 dark:outline-none backdrop-blur-2xl"
                size="xl"
                variant="subtle"
              >
                {{ t(item.labelKey) }}
              </UButton>
            </template>
          </ClientOnly>
          <UButton
            v-if="!isDiscordActivity"
            :loading="isJoining"
            class="text-xl py-2 px-4 cursor-pointer outline-1 dark:outline-none backdrop-blur-2xl"
            color="success"
            icon="i-solar-hand-shake-line-duotone"
            variant="subtle"
            @click="checkForActiveLobbyAndJoin"
          >
            {{ t("nav.joingame") }}
          </UButton>
          <UButton
            v-if="!isDiscordActivity"
            :disabled="!isAuthenticatedUser(userStore.user)"
            :icon="
              !isAuthenticatedUser(userStore.user)
                ? 'i-solar-double-alt-arrow-right-bold-duotone'
                : 'i-solar-add-square-bold-duotone'
            "
            :loading="isCreating"
            class="text-xl py-2 px-4 cursor-pointer outline-1 dark:outline-none backdrop-blur-2xl"
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
        <template v-if="isAuthenticatedUser(userStore.user)">
          <div
            ref="profileMenuRef"
            class="brand-profile-wrap"
            :class="{ 'is-open': profileMenuOpen }"
          >
            <button
              class="brand-profile-trigger"
              @click="profileMenuOpen = !profileMenuOpen"
            >
              <AvatarDecoration
                :decoration-id="userStore.user?.prefs?.activeDecoration"
              >
                <img
                  v-if="avatarUrl"
                  :src="avatarUrl"
                  :alt="userStore.user?.name ?? 'Profile'"
                  class="brand-profile-avatar"
                />
                <div
                  v-else
                  class="brand-profile-avatar fallback"
                  :style="fallbackGradient"
                >
                  {{ initials }}
                </div>
              </AvatarDecoration>

              <div class="brand-profile-meta">
                <div class="brand-profile-name font-display">
                  {{ userStore.user?.name ?? "Player" }}
                </div>
                <div class="brand-profile-rank font-mono">
                  <BrandLiveDot :size="6" />
                  <template v-if="stats.rank != null">
                    {{ t("brand.profile.rank_line", { rank: stats.rank }) }}
                  </template>
                  <template v-else>
                    {{ t("brand.online") }}
                  </template>
                </div>
              </div>

              <BrandIcon
                name="chevron-down"
                :size="10"
                class="brand-profile-chev"
              />
            </button>

            <div v-if="profileMenuOpen" class="brand-profile-menu panel">
              <div class="brand-profile-menu-header">
                <div class="brand-profile-menu-header-row">
                  <div
                    class="brand-profile-menu-avatar"
                    :style="fallbackGradient"
                  >
                    {{ initials }}
                  </div>
                  <div>
                    <div class="font-display brand-profile-menu-name">
                      {{ userStore.user?.name ?? "Player" }}
                    </div>
                    <div class="font-mono brand-profile-menu-sub">
                      {{ handle }}
                    </div>
                  </div>
                </div>

                <div class="brand-profile-stats">
                  <div class="brand-profile-stat">
                    <div class="brand-profile-stat-value font-display">
                      {{ stats.played ?? "—" }}
                    </div>
                    <div class="brand-profile-stat-label font-mono">
                      {{ t("brand.profile.stat_played") }}
                    </div>
                  </div>
                  <div class="brand-profile-stat">
                    <div class="brand-profile-stat-value font-display">
                      {{ stats.rank ?? "—" }}
                    </div>
                    <div class="brand-profile-stat-label font-mono">
                      {{ t("brand.profile.stat_rank") }}
                    </div>
                  </div>
                  <div class="brand-profile-stat">
                    <div class="brand-profile-stat-value font-display">
                      {{ stats.crowned ?? "—" }}
                    </div>
                    <div class="brand-profile-stat-label font-mono">
                      {{ t("brand.profile.stat_crowned") }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="ticket-sep" />

              <NuxtLink
                to="/profile"
                class="brand-menu-item"
                @click="profileMenuOpen = false"
              >
                <span class="brand-menu-emoji">👤</span>
                <span class="flex-1">{{ t("nav.profile") }}</span>
                <span class="brand-menu-kbd font-mono">P</span>
              </NuxtLink>

              <span class="brand-menu-item brand-menu-item-soon">
                <span class="brand-menu-emoji">🎨</span>
                <span class="flex-1">{{ t("brand.profile.decks") }}</span>
                <span class="brand-menu-soon font-mono">SOON</span>
              </span>

              <span class="brand-menu-item brand-menu-item-soon">
                <span class="brand-menu-emoji">🔔</span>
                <span class="flex-1">{{
                  t("brand.profile.notifications")
                }}</span>
                <span class="brand-menu-soon font-mono">SOON</span>
              </span>

              <button class="brand-menu-item" @click="onOpenSettings">
                <span class="brand-menu-emoji">⚙</span>
                <span class="flex-1">{{ t("nav.settings") }}</span>
                <span class="brand-menu-kbd font-mono">,</span>
              </button>

              <div class="ticket-sep" />

              <NuxtLink
                v-if="isAdmin"
                to="/admin"
                class="brand-menu-item brand-menu-item-accent"
                @click="profileMenuOpen = false"
              >
                <span class="brand-menu-emoji">🛡</span>
                <span class="flex-1">{{ t("nav.admin") }}</span>
              </NuxtLink>

              <button
                v-if="isDiscordActivity"
                class="brand-menu-item brand-menu-item-dim"
                @click="closeActivity"
              >
                <span class="brand-menu-emoji">↩</span>
                <span class="flex-1">{{ t("nav.close_activity") }}</span>
              </button>
              <button
                v-else
                class="brand-menu-item brand-menu-item-dim"
                @click="onProfileLogout"
              >
                <span class="brand-menu-emoji">↩</span>
                <span class="flex-1">{{ t("nav.logout") }}</span>
              </button>
            </div>
          </div>
        </template>

        <template v-else-if="!isDiscordActivity">
          <BrandNeonButton variant="default" @click="handleLoginWithDiscord">
            <BrandIcon name="discord" :size="16" />
            {{ t("nav.login_discord") }}
          </BrandNeonButton>
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
                <AvatarDecoration
                  :decoration-id="userStore.user?.prefs?.activeDecoration"
                >
                  <img
                    v-if="avatarUrl"
                    :src="avatarUrl"
                    alt="avatar"
                    class="w-10 h-10 rounded-full"
                  />
                </AvatarDecoration>
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
              <template v-for="item in navItems" :key="item.to">
                <UButton
                  v-if="
                    !item.authRequired || isAuthenticatedUser(userStore.user)
                  "
                  :color="item.color"
                  :icon="item.icon"
                  :to="item.to"
                  block
                  class="mb-2 text-xl py-3 border-2 dark:border-none"
                  size="xl"
                  variant="soft"
                >
                  {{ t(item.labelKey) }}
                </UButton>
              </template>
            </ClientOnly>
            <UButton
              v-if="!isDiscordActivity"
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
              v-if="!isDiscordActivity"
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

              <UButton
                v-if="isDiscordActivity"
                block
                class="mb-2 text-xl py-3 border-2 dark:border-none"
                color="error"
                icon="i-solar-close-square-bold-duotone"
                variant="soft"
                @click="closeActivity"
              >
                {{ t("nav.close_activity") }}
              </UButton>
              <UButton
                v-else
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

            <template v-else-if="!isDiscordActivity">
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

  <ClientOnly>
    <BrandSettingsDrawer />
  </ClientOnly>
</template>

<style scoped>
.brand-profile-wrap {
  position: relative;
}

.brand-profile-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px 6px 6px;
  border-radius: 999px;
  border: 1px solid var(--line-strong);
  background: rgba(10, 13, 28, 0.6);
  transition: background 140ms;
}
.brand-profile-trigger:hover {
  background: rgba(255, 255, 255, 0.04);
}

.brand-profile-avatar {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
  font-family: "Archivo Black", sans-serif;
  font-size: 12px;
  color: #fff;
  flex-shrink: 0;
}

.brand-profile-meta {
  text-align: left;
  display: none;
}

@media (min-width: 640px) {
  .brand-profile-meta {
    display: block;
  }
}

.brand-profile-name {
  font-size: 13px;
  line-height: 1;
}

.brand-profile-rank {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--ink-muted);
  line-height: 1;
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.brand-profile-chev {
  color: var(--ink-dim);
  transition: transform 200ms;
}
.brand-profile-wrap.is-open .brand-profile-chev {
  transform: rotate(180deg);
}

.brand-profile-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 260px;
  padding: 6px;
  z-index: 50;
  box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.8);
}

.brand-profile-menu-header {
  padding: 12px 12px 8px;
}

.brand-profile-menu-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-profile-menu-avatar {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Archivo Black", sans-serif;
  font-size: 13px;
  color: #fff;
}

.brand-profile-menu-name {
  font-size: 14px;
}
.brand-profile-menu-sub {
  font-size: 10px;
  color: var(--ink-muted);
  margin-top: 3px;
}

.brand-profile-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  margin-top: 12px;
  text-align: center;
}

.brand-profile-stat {
  padding: 6px 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
}

.brand-profile-stat-value {
  font-size: 18px;
  line-height: 1;
}

.brand-profile-stat-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--ink-muted);
  margin-top: 4px;
}

.brand-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: transparent;
  border: none;
  text-align: left;
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 600;
  font-size: 15px;
  color: var(--ink);
  transition: background 140ms;
}
.brand-menu-item:hover {
  background: rgba(255, 255, 255, 0.05);
}
.brand-menu-item-accent {
  color: var(--accent-2);
}
.brand-menu-item-dim {
  color: var(--ink-muted);
}
.brand-menu-item-soon {
  color: var(--ink-muted);
  cursor: not-allowed;
}
.brand-menu-item-soon:hover {
  background: transparent;
}

.brand-menu-emoji {
  font-size: 16px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.brand-menu-kbd {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid var(--line-strong);
  color: var(--ink-muted);
}

.brand-menu-soon {
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--ink-muted);
  letter-spacing: 0.15em;
}

.flex-1 {
  flex: 1;
  min-width: 0;
}

.ticket-sep {
  margin: 6px 0;
}
</style>
