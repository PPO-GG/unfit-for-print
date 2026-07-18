<template>
  <div class="index-root">
    <BrandTopBar />

    <section class="index-main">
      <div class="index-grid variant-enter">
        <!-- ─── Left: Hero ──────────────────────────────────── -->
        <div class="index-hero">
          <div class="index-hero-chips">
            <BrandChip>
              <BrandLiveDot :size="8" />
              {{ onlineCount }} online
            </BrandChip>
            <BrandChip>{{ season }}</BrandChip>
            <BrandChip>{{ version }}</BrandChip>
          </div>
          <div class="">
            <img
              src="/img/unfit_logo_alt.png"
              alt="Unfit for Print"
              class="p-0 w-96 -ml-4"
            />

            <p class="-mt-12 mb-4 text-2xl font-display">
              {{ t("tagline") }}
            </p>
          </div>

          <ClientOnly class="mb-4">
            <IndexResumeBanner />
          </ClientOnly>

          <ClientOnly>
            <IndexCardPreview />
          </ClientOnly>
        </div>

        <!-- ─── Right: Menu grid ────────────────────────────── -->
        <div class="index-menu">
          <div class="index-menu-head">
            <div>
              <div class="index-menu-eyebrow font-mono">Deal yourself in</div>
              <div class="index-menu-title font-display">PICK YOUR PLAY</div>
            </div>
            <BrandChip>⌘ + key to jump</BrandChip>
          </div>

          <div class="index-menu-grid">
            <!-- New Game — featured, 3 cols × 2 rows -->
            <IndexArcadeMenuCard
              class="index-menu-cell new-game"
              accent="yellow"
              icon="new"
              :label="isLoggedIn ? 'NEW GAME' : 'LOG IN TO PLAY'"
              :sub="
                isLoggedIn
                  ? 'Host a fresh lobby'
                  : 'Sign in with Discord to host'
              "
              kbd="N"
              featured
              :foot-note="isCreating ? 'Creating lobby…' : 'Fast setup'"
              :disabled="isCreating || isDiscordActivity"
              @click="onNewGame"
            />

            <!-- Join Game — 3 cols -->
            <IndexArcadeMenuCard
              class="index-menu-cell join-game"
              accent="pink"
              icon="join"
              label="JOIN GAME"
              sub="Enter a 4-letter code"
              kbd="J"
              :disabled="isJoining || isDiscordActivity"
              @click="onJoinGame"
            >
              <template #rightSlot>
                <div class="code-preview">
                  <div v-for="i in 4" :key="i" class="code-preview-cell" />
                </div>
              </template>
            </IndexArcadeMenuCard>

            <!-- My Games — 3 cols -->
            <IndexArcadeMenuCard
              class="index-menu-cell games"
              accent="cyan"
              icon="games"
              label="MY GAMES"
              sub="Active & past rounds"
              kbd="G"
              to="/game"
            />

            <!-- Labs — 2 cols -->
            <IndexArcadeMenuCard
              class="index-menu-cell labs"
              accent="lime"
              icon="labs"
              label="LABS"
              sub="Experimental decks"
              kbd="L"
              badge="beta"
              to="/labs"
            />

            <!-- How to Play — 2 cols -->
            <IndexArcadeMenuCard
              class="index-menu-cell how"
              accent="black"
              icon="how"
              label="HOW TO PLAY"
              sub="60-second rundown"
              kbd="?"
              to="/about"
            />

            <!-- Leaderboards — 2 cols (not wired yet) -->
            <IndexArcadeMenuCard
              class="index-menu-cell leaderboards"
              accent="black"
              icon="trophy"
              label="LEADERBOARDS"
              sub="Coming soon"
              kbd="B"
              disabled
            />

            <!-- Admin — only shown to admins, 2 cols -->
            <IndexArcadeMenuCard
              v-if="isAdmin"
              class="index-menu-cell admin"
              accent="black"
              icon="shield"
              label="ADMIN"
              sub="Mission control"
              kbd="A"
              to="/admin"
            />

            <!-- Hub — only inside Discord activity, 2 cols -->
            <IndexArcadeMenuCard
              v-if="isDiscordActivity"
              class="index-menu-cell hub"
              accent="black"
              icon="discord"
              label="HUB"
              sub="Server channel hub"
              to="/activity/hub"
            />
          </div>
        </div>
      </div>
    </section>

    <BrandFooterTicker />

    <BrandJoinTakeover :open="showJoin" @close="showJoin = false" />
  </div>
</template>

<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { useLobbyActions } from "~/composables/useLobbyActions";
import { useIsAdmin } from "~/composables/useAdminCheck";
import { useUserStore } from "~/stores/userStore";
import { isAuthenticatedUser } from "~/composables/useUserUtils";
import { useNotifications } from "~/composables/useNotifications";

definePageMeta({
  layout: "default",
});

const { t } = useI18n();
const userStore = useUserStore();
const isAdmin = useIsAdmin();
const router = useRouter();
const route = useRoute();
const { isDiscordActivity } = useDiscordSDK();
const { notify } = useNotifications();

const isLoggedIn = computed(() => isAuthenticatedUser(userStore.user));

const {
  checkForActiveLobbyAndCreate,
  checkForActiveLobbyAndJoin,
  isCreating,
  isJoining,
  showJoin,
} = useLobbyActions();

const { onlineCount, season, version } = useBrandStatus();

/**
 * "New Game" tile handler.
 *
 * - If already creating, bail.
 * - If in a Discord activity iframe, bail (those sessions join via hub).
 * - If not logged in, kick off Discord OAuth — the old main menu
 *   gated Create Game behind login via a disabled button; this form
 *   is friendlier and matches the new design's single-tile CTA.
 * - Otherwise, check for an existing lobby (redirect) or create one.
 */
async function onNewGame() {
  if (isCreating.value || isDiscordActivity.value) return;
  if (!isLoggedIn.value) {
    try {
      await userStore.loginWithDiscord();
    } catch (err) {
      console.error("[index] login failed", err);
      notify({ title: t("notification.login_failed"), color: "error" });
    }
    return;
  }
  await checkForActiveLobbyAndCreate();
}

function onJoinGame() {
  if (isJoining.value || isDiscordActivity.value) return;
  checkForActiveLobbyAndJoin();
}

// ─── OAuth callback safety net ─────────────────────────────────
// If Discord OAuth accidentally lands on the root (e.g., service
// worker intercepted /auth/callback), forward to the real handler
// with the original userId + secret so we don't lose the session.
if (import.meta.client) {
  const oauthUserId = route.query.userId as string | undefined;
  const oauthSecret = route.query.secret as string | undefined;
  if (oauthUserId && oauthSecret) {
    router.replace({
      path: "/auth/callback",
      query: { userId: oauthUserId, secret: oauthSecret },
    });
  }
}

// ─── Keyboard shortcuts ────────────────────────────────────────
// Match the kbd hints on the menu tiles: N = new, J = join,
// G = games, L = labs, ? = how-to, A = admin.
function handleShortcut(e: KeyboardEvent) {
  if (!import.meta.client) return;
  // Join takeover captures its own keystrokes on a focusable <div>, so
  // the tag-name guard below can't see it. Skip shortcuts entirely
  // while it's open.
  if (showJoin.value) return;
  const t = e.target as HTMLElement | null;
  if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  if (t && t.isContentEditable) return;

  switch (e.key.toLowerCase()) {
    case "n":
      void onNewGame();
      break;
    case "j":
      onJoinGame();
      break;
    case "g":
      router.push("/game");
      break;
    case "l":
      router.push("/labs");
      break;
    case "?":
      router.push("/about");
      break;
    case "a":
      if (isAdmin.value) router.push("/admin");
      break;
    default:
      break;
  }
}

onMounted(() => window.addEventListener("keydown", handleShortcut));
onBeforeUnmount(() => window.removeEventListener("keydown", handleShortcut));

useHead({ title: "Unfit for Print" });
</script>

<style scoped>
/* Fill the layout's flex-column main area so the footer sinks to the
   bottom of the viewport when content is short. */
.index-root {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.index-main {
  flex: 1;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 24px 40px;
}

@media (min-width: 768px) {
  .index-main {
    padding: 40px 40px 60px;
  }
}

.index-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 32px;
  align-items: start;
}

@media (min-width: 1024px) {
  .index-grid {
    grid-template-columns: 5fr 7fr;
    align-items: center;
  }
}
.index-hero-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* ─── Menu grid (right) ───────────────────────────────────── */
.index-menu {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.index-menu-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.index-menu-eyebrow {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--ink-muted);
}

.index-menu-title {
  font-size: 24px;
  line-height: 1;
  margin-top: 4px;
}

.index-menu-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}

/* Cell spans — mirror the prototype's proportions */
.index-menu-cell.new-game {
  grid-column: span 6;
}
.index-menu-cell.join-game,
.index-menu-cell.games {
  grid-column: span 6;
}
.index-menu-cell.labs,
.index-menu-cell.how,
.index-menu-cell.leaderboards,
.index-menu-cell.admin,
.index-menu-cell.hub {
  grid-column: span 3;
}

@media (min-width: 768px) {
  .index-menu-cell.new-game {
    grid-column: span 3;
    grid-row: span 2;
  }
  .index-menu-cell.join-game,
  .index-menu-cell.games {
    grid-column: span 3;
  }
  .index-menu-cell.labs,
  .index-menu-cell.how,
  .index-menu-cell.leaderboards,
  .index-menu-cell.admin,
  .index-menu-cell.hub {
    grid-column: span 2;
  }
}

/* ─── Code preview (Join Game tile) ───────────────────────── */
.code-preview {
  display: flex;
  gap: 4px;
  margin-top: 8px;
}

.code-preview-cell {
  width: 24px;
  height: 28px;
  border-radius: 4px;
  border: 1.5px solid rgba(13, 15, 26, 0.35);
  background: rgba(13, 15, 26, 0.08);
}
</style>
