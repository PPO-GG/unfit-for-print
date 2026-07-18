<!--
  Announcements — in-game banners + Discord-shareable notices.

  The Announcements feature is net-new (no backing Appwrite collection
  yet). See docs/admin-ui-future-features.md for the planned schema
  and rollout plan.
-->
<template>
  <div>
    <AdminPageHeader
      eyebrow="Content · Broadcast"
      title="Announcements"
      sub="In-game banners shown on the homepage. Toggle Discord sharing to let server owners embed them."
    >
      <template #actions>
        <NuxtLink to="/" class="btn ghost">View as player</NuxtLink>
        <button class="btn primary" @click="openCompose()">
          <AdminIcon name="plus" /> New Announcement
        </button>
      </template>
    </AdminPageHeader>

    <div class="filter-tabs mb-4">
      <button
        v-for="f in filters"
        :key="f.id"
        :class="['filter-tab', { active: filter === f.id }]"
        @click="filter = f.id"
      >
        {{ f.label }} <span class="count">{{ f.n }}</span>
      </button>
    </div>

    <div class="announcement-list">
      <div v-for="a in filtered" :key="a.id" class="panel announcement-card">
        <!-- Top row: status + meta -->
        <div class="meta-row">
          <div class="meta-left">
            <AdminStatusPill :variant="a.status">{{ a.status }}</AdminStatusPill>
            <span class="meta-mono">{{ a.posted }}</span>
            <span class="meta-mono">·</span>
            <span class="meta-mono uppercase">
              {{ audienceLabel(a.audience) }}
            </span>
            <span v-if="a.discord_share" class="discord-badge">
              <AdminIcon name="discord" :size="10" />
              DISCORD-EMBEDDABLE
            </span>
          </div>
          <div class="meta-actions">
            <button v-if="a.status === 'draft'" class="btn sm primary" @click="publish(a.id)">Publish</button>
            <button v-if="a.status === 'scheduled'" class="btn sm">Reschedule</button>
            <button v-if="a.status === 'live'" class="btn sm danger" @click="end(a.id)">End now</button>
            <button class="btn sm ghost" @click="openCompose(a)">Edit</button>
            <button class="btn sm ghost"><AdminIcon name="more" /></button>
          </div>
        </div>

        <AdminBannerPreview
          :title="a.title"
          :body="a.body"
          :cta="a.cta"
          :color="a.bannerColor"
        />

        <div
          v-if="a.status === 'live' || a.status === 'ended'"
          class="stats-grid"
        >
          <div>
            <div class="stat4-label">Impressions</div>
            <div class="stat4-value">{{ a.impressions }}</div>
          </div>
          <div>
            <div class="stat4-label">Clicks</div>
            <div class="stat4-value">{{ a.clicks }}</div>
          </div>
          <div>
            <div class="stat4-label">CTR</div>
            <div class="stat4-value">{{ a.ctr }}</div>
          </div>
          <div>
            <div class="stat4-label">CTA URL</div>
            <div class="stat4-value mono">{{ a.cta_url }}</div>
          </div>
        </div>
      </div>
    </div>

    <AdminAnnouncementComposerModal
      v-if="composer !== null"
      :initial="composer.edit"
      @close="composer = null"
      @save="onComposerSave"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  AdminAnnouncement,
  AdminAnnouncementAudience,
  AdminAnnouncementStatus,
} from "~/types/admin";

definePageMeta({
  layout: "admin",
  middleware: "admin",
});

const { announcements, save, publish, end } = useAdminAnnouncements();

type Filter = "all" | AdminAnnouncementStatus;
const filter = ref<Filter>("all");

const filtered = computed<AdminAnnouncement[]>(() =>
  filter.value === "all"
    ? announcements.value
    : announcements.value.filter(a => a.status === filter.value),
);

const filters = computed(() => [
  { id: "all" as const, label: "All", n: announcements.value.length },
  { id: "live" as const, label: "Live", n: announcements.value.filter(a => a.status === "live").length },
  { id: "scheduled" as const, label: "Scheduled", n: announcements.value.filter(a => a.status === "scheduled").length },
  { id: "draft" as const, label: "Drafts", n: announcements.value.filter(a => a.status === "draft").length },
  { id: "ended" as const, label: "Ended", n: announcements.value.filter(a => a.status === "ended").length },
]);

function audienceLabel(a: AdminAnnouncementAudience): string {
  if (a === "all") return "ALL PLAYERS";
  if (a === "logged-in") return "LOGGED IN ONLY";
  return "ACTIVE IN LAST 7D";
}

const composer = ref<{ edit?: AdminAnnouncement } | null>(null);

function openCompose(edit?: AdminAnnouncement) {
  composer.value = edit ? { edit } : {};
}

async function onComposerSave(draft: AdminAnnouncement) {
  await save(draft);
  composer.value = null;
}
</script>

<style scoped>
.announcement-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.announcement-card {
  padding: 18px;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 10px;
}

.meta-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.meta-mono {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  color: var(--ink-muted);
  letter-spacing: 0.12em;
}

.meta-mono.uppercase { text-transform: uppercase; }

.meta-actions {
  display: flex;
  gap: 6px;
}

.discord-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(88, 101, 242, 0.12);
  border: 1px solid #5865f2;
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  letter-spacing: 0.12em;
  color: #7983f5;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-top: 14px;
  padding: 12px 0 0;
  border-top: 1px solid var(--line);
}

.stat4-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  color: var(--ink-muted);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.stat4-value {
  font-family: "Archivo Black", sans-serif;
  font-size: 16px;
  margin-top: 4px;
  color: var(--ink);
}

.stat4-value.mono {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
}
</style>
