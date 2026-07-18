<!--
  Compose or edit an announcement. Emits `save` with the working draft
  (plus an intent — publish / schedule / draft) when confirmed.
-->
<template>
  <AdminModal
    :title="initial ? 'Edit Announcement' : 'New Announcement'"
    :eyebrow="initial ? 'Edit' : 'Compose'"
    :width="680"
    @close="emit('close')"
  >
    <template #body>
      <div>
        <label class="label">Title</label>
        <input v-model="title" class="input" placeholder="Season 03 ends Friday" />
      </div>

      <div>
        <label class="label">Body</label>
        <textarea v-model="body" class="textarea" placeholder="Top 100 get the Founders Ring..." />
      </div>

      <div class="two-col">
        <div>
          <label class="label">CTA Label</label>
          <input v-model="cta" class="input" />
        </div>
        <div>
          <label class="label">CTA URL</label>
          <input v-model="ctaUrl" class="input" placeholder="/leaderboards" />
        </div>
      </div>

      <div>
        <label class="label">Banner Color</label>
        <div class="color-row">
          <button
            v-for="c in (['yellow', 'pink', 'cyan', 'lime'] as const)"
            :key="c"
            type="button"
            :class="['color-swatch', c, { selected: color === c }]"
            @click="color = c"
          >{{ c }}</button>
        </div>
      </div>

      <div class="two-col">
        <div>
          <label class="label">Audience</label>
          <select v-model="audience" class="select">
            <option value="all">All players</option>
            <option value="logged-in">Logged-in only</option>
            <option value="active">Active in last 7d</option>
          </select>
        </div>
        <div>
          <label class="label">Schedule</label>
          <select v-model="schedule" class="select">
            <option value="now">Publish now</option>
            <option value="later">Schedule for later…</option>
            <option value="draft">Save as draft</option>
          </select>
        </div>
      </div>

      <div
        :class="['discord-card', { on: discord }]"
        role="button"
        tabindex="0"
        @click="discord = !discord"
        @keydown.enter.prevent="discord = !discord"
        @keydown.space.prevent="discord = !discord"
      >
        <div class="discord-icon">
          <AdminIcon name="discord" :size="18" />
        </div>
        <div class="discord-meta">
          <div class="discord-title">Discord-embeddable</div>
          <div class="discord-sub">Server owners can opt-in to display this banner in their UFP channel.</div>
        </div>
        <div :class="['discord-toggle', { on: discord }]">
          <div :class="['discord-knob', { on: discord }]" />
        </div>
      </div>

      <div>
        <label class="label">Preview</label>
        <AdminBannerPreview
          :title="title || 'Your title here'"
          :body="body || 'Your message body…'"
          :cta="cta"
          :color="color"
        />
      </div>
    </template>

    <template #footer>
      <button class="btn ghost" @click="emit('close')">Cancel</button>
      <button v-if="schedule === 'draft'" class="btn" @click="onSave">Save draft</button>
      <button v-else-if="schedule === 'later'" class="btn cyan" @click="onSave">Schedule</button>
      <button v-else class="btn primary" @click="onSave">Publish now</button>
    </template>
  </AdminModal>
</template>

<script setup lang="ts">
import type {
  AdminAnnouncement,
  AdminAnnouncementAudience,
  AdminAnnouncementBannerColor,
  AdminAnnouncementStatus,
} from "~/types/admin";

const props = defineProps<{
  initial?: AdminAnnouncement;
}>();

const emit = defineEmits<{
  close: [];
  save: [draft: AdminAnnouncement];
}>();

const title = ref<string>(props.initial?.title ?? "");
const body = ref<string>(props.initial?.body ?? "");
const cta = ref<string>(props.initial?.cta ?? "Learn more");
const ctaUrl = ref<string>(props.initial?.cta_url ?? "");
const color = ref<AdminAnnouncementBannerColor>(props.initial?.bannerColor ?? "yellow");
const discord = ref<boolean>(props.initial?.discord_share ?? true);
const audience = ref<AdminAnnouncementAudience>(props.initial?.audience ?? "all");
const schedule = ref<"now" | "later" | "draft">("now");

function onSave() {
  const status: AdminAnnouncementStatus =
    schedule.value === "draft" ? "draft" :
    schedule.value === "later" ? "scheduled" :
    "live";

  const draft: AdminAnnouncement = {
    id: props.initial?.id ?? `new-${Date.now()}`,
    title: title.value,
    body: body.value,
    cta: cta.value,
    cta_url: ctaUrl.value,
    status,
    audience: audience.value,
    bannerColor: color.value,
    posted: status === "live" ? "Just now" : status === "scheduled" ? "Scheduled" : "Draft",
    discord_share: discord.value,
    impressions: "—",
    clicks: "—",
    ctr: "—",
  };
  emit("save", draft);
  emit("close");
}
</script>

<style scoped>
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.color-row {
  display: flex;
  gap: 8px;
}

.color-swatch {
  flex: 1;
  height: 36px;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  font-family: "Archivo Black", sans-serif;
  font-size: 10px;
  color: #0d0f1a;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.color-swatch.selected { border-color: #f6f3ea; }
.color-swatch.yellow { background: linear-gradient(90deg, oklch(82% 0.18 95), oklch(78% 0.22 60)); }
.color-swatch.pink { background: linear-gradient(90deg, oklch(72% 0.22 355), oklch(68% 0.25 20)); }
.color-swatch.cyan { background: linear-gradient(90deg, oklch(78% 0.20 195), oklch(74% 0.18 220)); }
.color-swatch.lime { background: linear-gradient(90deg, oklch(80% 0.20 140), oklch(76% 0.22 110)); }

.discord-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.015);
  cursor: pointer;
  transition: background 140ms, border-color 140ms;
}
.discord-card.on {
  border-color: #5865f2;
  background: rgba(88, 101, 242, 0.08);
}
.discord-card:focus-visible {
  outline: 2px solid var(--accent-3);
  outline-offset: 2px;
}

.discord-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #5865f2;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.discord-meta {
  flex: 1;
}

.discord-title {
  font-family: "Archivo Black", sans-serif;
  font-size: 13px;
  text-transform: uppercase;
}

.discord-sub {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  color: var(--ink-muted);
  letter-spacing: 0.1em;
  margin-top: 3px;
}

.discord-toggle {
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--line-strong);
  position: relative;
  flex-shrink: 0;
}
.discord-toggle.on {
  background: #5865f2;
  border-color: #5865f2;
}

.discord-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--ink-dim);
  transition: left 180ms;
}
.discord-knob.on {
  left: 18px;
  background: #fff;
}
</style>
