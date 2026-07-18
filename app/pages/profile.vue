<!--
  Player profile — ported from the Claude Design prototype.

  Long scrolling layout: hero → stats → favorites + friends → decorations
  → achievements → match history.

  Current wiring:
    - Hero avatar, name, discord handle, joined date, equipped decoration:
      REAL (userStore + useDecorations).
    - Level / XP / title / bio: MOCK overlay (PROFILE_PLAYER_OVERLAY_MOCK).
    - Stats, achievements, matches, friends: ALL MOCK.
    - Decoration grid: REAL (useDecorations catalog + equip/unequip +
      Discord purchase flow).
    - Edit / Share / Invite buttons: no-ops for now, wire as features land.
    - Settings button opens the existing Brand settings drawer.

  The full stub → real swap plan is in
  `docs/ui-overhaul-future-features.md` → Profile section.
-->
<template>
  <div class="relative z-10">
    <BrandTopBar />

    <div class="ufp-profile">
      <div class="max-w-[1400px] mx-auto px-6 py-6">
        <!-- Sub-header: breadcrumb -->
        <div
          class="font-mono uppercase flex items-center mb-6"
          :style="{
            fontSize: '11px',
            letterSpacing: '0.15em',
            color: 'var(--ink-muted)',
          }"
        >
          <NuxtLink
            to="/"
            class="hover:text-white"
            :style="{ color: 'var(--ink-dim)' }"
          >
            ARCADE
          </NuxtLink>
          <span
            class="mx-2 opacity-60"
            :style="{ color: 'var(--ink-muted)' }"
          >/</span>
          <span :style="{ color: 'var(--ink)' }">PROFILE</span>
        </div>

        <!-- Loading skeleton while the user session is resolving -->
        <div v-if="!hydrated" class="flex flex-col gap-6">
          <USkeleton class="h-64 w-full rounded-2xl" />
          <USkeleton class="h-40 w-full rounded-2xl" />
          <USkeleton class="h-60 w-full rounded-2xl" />
        </div>

        <div v-else class="fade-in flex flex-col gap-6">
          <ProfilePlayerHero
            :player="player"
            :self="self"
            :equipped-entry="equippedEntry"
            @edit="onEdit"
            @share="onShare"
            @settings="openSettings"
            @change-decoration="scrollToDecorations"
          />

          <div class="hr-label">Player stats</div>
          <ProfileStatsBlock :stats="stats" />

          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12 lg:col-span-8">
              <ProfileFavoriteCards :cards="stats.favCards" />
            </div>
            <div class="col-span-12 lg:col-span-4">
              <ProfileFriendsBlock
                :friends="friends"
                :online-count="onlineCount"
              />
            </div>
          </div>

          <div id="decorations-section" class="hr-label">
            Avatar decorations
          </div>
          <ProfileDecorationsBlock
            :self="self"
            :avatar-url="player.avatarUrl"
            :initials="player.initials"
          />

          <div class="hr-label">Achievements</div>
          <ProfileAchievementsBlock :achievements="achievements" />

          <div class="hr-label">Match history</div>
          <ProfileMatchesBlock :matches="matches" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: ["auth"],
});

useHead({ title: "Profile · Unfit for Print" });

// ─── Player + data composables (real where possible, mock fallbacks) ───────
const { player } = useProfilePlayer();
const { stats } = useProfileStats();
const { achievements } = useProfileAchievements();
const { matches } = useProfileMatches();
const { friends, onlineCount } = useProfileFriends();

// ─── Decoration catalog (used for the equipped flavor card on hero) ────────
const { catalog, fetchCatalog } = useDecorations();
const equippedEntry = computed(() => {
  const id = player.value.equippedDecoration;
  if (!id) return null;
  return catalog.value.find((c) => c.decorationId === id) ?? null;
});

// Self-view only for now. Viewing other users needs a new data path
// (see docs/ui-overhaul-future-features.md § Profile).
const self = true;

// ─── Hydration (avoid SSR user-dependent render mismatches) ────────────────
const hydrated = ref(false);
onMounted(() => {
  hydrated.value = true;
  void fetchCatalog();
});

// ─── Actions ───────────────────────────────────────────────────────────────
const { openDrawer } = useBrandSettings();
function openSettings() {
  openDrawer();
}

function onEdit() {
  // Placeholder — profile editing UI (display name / bio / avatar
  // crop) isn't built yet. See future-features doc.
}

async function onShare() {
  if (!import.meta.client) return;
  const url = window.location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: "My Unfit for Print profile", url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  } catch {
    // User canceled or clipboard not available — silently ignore.
  }
}

function scrollToDecorations() {
  if (!import.meta.client) return;
  document
    .getElementById("decorations-section")
    ?.scrollIntoView({ behavior: "smooth" });
}
</script>
