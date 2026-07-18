<template>
  <header class="brand-topbar">
    <div class="brand-topbar-actions">
      <ClientOnly>
        <template v-if="isLoggedIn">
          <div
            ref="menuRef"
            class="brand-profile-wrap"
            :class="{ 'is-open': menuOpen }"
          >
            <button class="brand-profile-trigger" @click="menuOpen = !menuOpen">
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

            <div v-if="menuOpen" class="brand-profile-menu panel">
              <!-- Header with avatar + name + handle + stats grid -->
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

              <!-- Primary items -->
              <NuxtLink
                to="/profile"
                class="brand-menu-item"
                @click="menuOpen = false"
              >
                <span class="brand-menu-emoji">👤</span>
                <span class="flex-1">{{ t("nav.profile") }}</span>
                <span class="brand-menu-kbd font-mono">P</span>
              </NuxtLink>

              <!-- Decks & Cosmetics — placeholder until the player-facing
                   decoration browser is built. -->
              <span class="brand-menu-item brand-menu-item-soon">
                <span class="brand-menu-emoji">🎨</span>
                <span class="flex-1">{{ t("brand.profile.decks") }}</span>
                <span class="brand-menu-soon font-mono">SOON</span>
              </span>

              <!-- Notifications — same story. Badge count comes from the
                   future notifications pipeline; for now we don't show one. -->
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
                @click="menuOpen = false"
              >
                <span class="brand-menu-emoji">🛡</span>
                <span class="flex-1">{{ t("nav.admin") }}</span>
              </NuxtLink>

              <button
                class="brand-menu-item brand-menu-item-dim"
                @click="handleLogout"
              >
                <span class="brand-menu-emoji">↩</span>
                <span class="flex-1">{{ t("nav.logout") }}</span>
              </button>
            </div>
          </div>
        </template>

        <template v-else>
          <BrandNeonButton variant="default" @click="handleLoginWithDiscord">
            <BrandIcon name="discord" :size="16" />
            {{ t("nav.login_discord") }}
          </BrandNeonButton>
        </template>

        <!-- The drawer lives at the TopBar level so it's available on
             every brand page (brand layout mounts TopBar via the page). -->
        <BrandSettingsDrawer />
      </ClientOnly>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onClickOutside } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { useUserStore } from "~/stores/userStore";
import { useIsAdmin } from "~/composables/useAdminCheck";
import { useNotifications } from "~/composables/useNotifications";
import { isAuthenticatedUser } from "~/composables/useUserUtils";

const { t } = useI18n();
const userStore = useUserStore();
const isAdmin = useIsAdmin();
const { notify } = useNotifications();
const { stats } = useBrandPlayerStats();
const { open: settingsOpen, openDrawer } = useBrandSettings();

const menuOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);
onClickOutside(menuRef, () => (menuOpen.value = false));

const isLoggedIn = computed(() => isAuthenticatedUser(userStore.user));

const avatarUrl = computed<string | null>(() => {
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

async function handleLoginWithDiscord() {
  try {
    await userStore.loginWithDiscord();
  } catch (err) {
    console.error("Login error:", err);
    notify({ title: t("notification.login_failed"), color: "error" });
  }
}

async function handleLogout() {
  menuOpen.value = false;
  try {
    await userStore.logout();
    notify({ title: t("notification.logged_out"), color: "success" });
  } catch (err) {
    console.error("Logout error:", err);
    notify({ title: t("notification.logout_failed"), color: "error" });
  }
}

function onOpenSettings() {
  menuOpen.value = false;
  openDrawer();
}

// Comma-key shortcut — matches the design prototype. Ignore when typing
// into any form element.
function onKeyDown(e: KeyboardEvent) {
  if (e.key !== ",") return;
  const t = e.target as HTMLElement | null;
  if (t && t.closest("input,textarea,select,[contenteditable='true']")) return;
  // Toggle; also close the profile menu if open.
  menuOpen.value = false;
  settingsOpen.value = !settingsOpen.value;
}

onMounted(() => window.addEventListener("keydown", onKeyDown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeyDown));
</script>

<style scoped>
.brand-topbar {
  position: relative;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  gap: 20px;
}

@media (min-width: 768px) {
  .brand-topbar {
    padding: 16px 40px;
  }
}

.brand-topbar-logo {
  flex-shrink: 0;
}

.brand-topbar-nav {
  display: flex;
  align-items: center;
  gap: 2px;
}

.brand-topbar-navlink {
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 14px;
  padding: 8px 12px;
  border-radius: 6px;
  color: var(--ink-dim);
  transition:
    background 140ms,
    color 140ms;
}
.brand-topbar-navlink:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--ink);
}
.brand-topbar-navlink.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.brand-topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.brand-topbar-search {
  display: none;
  align-items: center;
  gap: 8px;
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ink-dim);
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--line-strong);
  background: transparent;
  transition: color 140ms;
}
.brand-topbar-search:hover {
  color: var(--ink);
}

@media (min-width: 768px) {
  .brand-topbar-search {
    display: flex;
  }
}

/* ─── Profile trigger + dropdown ────────────────────────────── */
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

/* Stats grid (Played / Rank / Crowned) */
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

/* Menu items */
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
