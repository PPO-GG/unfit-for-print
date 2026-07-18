<!--
  Moderation queue — review user-submitted cards from Labs.
-->
<template>
  <div>
    <AdminPageHeader
      eyebrow="Operate · Moderation"
      title="Moderation Queue"
      sub="Review user-submitted cards from Labs. Approve to graduate, send to playtest, or reject."
    >
      <template #actions>
        <button class="btn ghost">Export CSV</button>
        <NuxtLink to="/labs" class="btn">
          <AdminIcon name="external" />
          Open Labs
        </NuxtLink>
      </template>
    </AdminPageHeader>

    <!-- Filter strip -->
    <div class="filter-strip">
      <div class="filter-tabs">
        <button
          v-for="f in filters"
          :key="f.id"
          :class="['filter-tab', { active: filter === f.id }]"
          @click="filter = f.id"
        >
          {{ f.label }} <span class="count">{{ f.count }}</span>
        </button>
      </div>
      <div v-if="bulk.size > 0" class="bulk-actions">
        <span class="bulk-count">{{ bulk.size }} selected</span>
        <button class="btn sm cyan" @click="bulkApprove">
          <AdminIcon name="check" /> Approve all
        </button>
        <button class="btn sm ghost" @click="bulkPlaytest">Send to playtest</button>
        <button class="btn sm danger" @click="bulkReject">
          <AdminIcon name="x" /> Reject all
        </button>
      </div>
    </div>

    <!-- Two-pane: list + detail -->
    <div class="two-pane">
      <div class="panel">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 30px" />
              <th>Card</th>
              <th>Author</th>
              <th>Score</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="s in filtered"
              :key="s.id"
              :class="{ selected: s.id === selectedId }"
              @click="selectedId = s.id"
            >
              <td @click.stop>
                <input type="checkbox" :checked="bulk.has(s.id)" @change="toggleBulk(s.id)" />
              </td>
              <td>
                <div class="card-cell">
                  <AdminKindPill :kind="s.kind">{{ s.kind === "prompt" ? "P" : "A" }}</AdminKindPill>
                  <AdminCardMini :kind="s.kind" class="mod-mini">
                    {{ s.text.length > 80 ? s.text.slice(0, 80) + "…" : s.text }}
                  </AdminCardMini>
                  <AdminStatusPill v-if="s.flag" variant="high" :title="s.flag">
                    ⚠ {{ s.flag.replace("auto-", "") }}
                  </AdminStatusPill>
                </div>
              </td>
              <td>
                <div class="author-name">@{{ s.author }}</div>
                <div class="author-date">{{ s.date }}</div>
              </td>
              <td>
                <span class="vote-up">+{{ s.up }}</span>
                <span class="vote-down">−{{ s.down }}</span>
              </td>
              <td>
                <AdminStatusPill :variant="s.status">{{ s.status }}</AdminStatusPill>
              </td>
              <td>
                <AdminIcon name="more" class="row-more" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Detail pane -->
      <div v-if="selected" class="panel detail-pane">
        <div class="panel-header">
          <div>
            <div class="panel-eyebrow">Reviewing #{{ selected.id }}</div>
            <div class="panel-title">
              {{ selected.kind === "prompt" ? "Prompt card" : "Answer card" }}
            </div>
          </div>
          <AdminStatusPill :variant="selected.status">{{ selected.status }}</AdminStatusPill>
        </div>

        <div class="detail-body">
          <!-- Big card preview -->
          <div class="card-frame">
            <AdminCardMini :kind="selected.kind" class="big-card">
              <div class="big-card-body">{{ selected.text }}</div>
              <div class="big-card-footer">
                <div class="brand-mark">UNFIT FOR PRINT</div>
                <div v-if="selected.kind === 'prompt'" class="pick-mark">
                  PICK {{ selected.picks || 1 }}
                </div>
              </div>
            </AdminCardMini>
          </div>

          <!-- Stat trio -->
          <div class="stat-row">
            <div class="stat-card">
              <div class="stat-value" style="color: var(--accent-4)">{{ selected.up }}</div>
              <div class="stat-label">Upvotes</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: var(--danger)">{{ selected.down }}</div>
              <div class="stat-label">Downvotes</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: var(--accent-3)">{{ approvalPct }}%</div>
              <div class="stat-label">Approval</div>
            </div>
          </div>

          <div v-if="selected.flag" class="flag-warning">
            <strong class="flag-warning-title">⚠ Auto-flag · {{ selected.flag }}</strong>
            <div class="flag-warning-body">
              <template v-if="selected.flag === 'auto-toxic'">
                Detected slur or harassing language. Recommended action: reject + warn user.
              </template>
              <template v-else-if="selected.flag === 'auto-low-quality'">
                Net negative votes + likely gibberish. Recommended: reject.
              </template>
            </div>
          </div>

          <label class="label">Reviewer note (internal)</label>
          <textarea
            v-model="reviewerNote"
            class="textarea"
            placeholder="Add context for the team or feedback to send to the author…"
          />

          <div class="action-grid">
            <button class="btn primary" @click="onApprove">
              <AdminIcon name="check" /> Approve &amp; graduate
            </button>
            <button class="btn cyan" @click="onPlaytest">
              <AdminIcon name="beaker" /> Send to playtest
            </button>
            <button class="btn ghost">Request edit</button>
            <button class="btn danger" @click="onReject">
              <AdminIcon name="x" /> Reject
            </button>
          </div>

          <div class="divider" />

          <div>
            <div class="label">Author</div>
            <div class="author-row">
              <div class="author-avatar">
                {{ selected.author.slice(0, 2).toUpperCase() }}
              </div>
              <div class="author-meta">
                <div class="author-handle">@{{ selected.author }}</div>
                <div class="author-stats">
                  14 cards submitted · 3 graduated · 0 reports
                </div>
              </div>
              <button class="btn sm ghost">View profile</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AdminModerationSubmission } from "~/types/admin";

definePageMeta({
  layout: "admin",
  middleware: "admin",
});

const { submissions, approve, reject, sendToPlaytest } = useAdminModeration();

type Filter = "all" | "flagged" | "playtest" | "answers" | "prompts";
const filter = ref<Filter>("all");

const filtered = computed<AdminModerationSubmission[]>(() => {
  const list = submissions.value;
  switch (filter.value) {
    case "flagged": return list.filter(s => s.flag);
    case "playtest": return list.filter(s => s.status === "playtest");
    case "answers": return list.filter(s => s.kind === "answer");
    case "prompts": return list.filter(s => s.kind === "prompt");
    default: return list;
  }
});

const filters = computed(() => [
  { id: "all" as const, label: "All", count: submissions.value.length },
  { id: "flagged" as const, label: "Auto-flagged", count: submissions.value.filter(s => s.flag).length },
  { id: "playtest" as const, label: "Playtest", count: submissions.value.filter(s => s.status === "playtest").length },
  { id: "answers" as const, label: "Answers", count: submissions.value.filter(s => s.kind === "answer").length },
  { id: "prompts" as const, label: "Prompts", count: submissions.value.filter(s => s.kind === "prompt").length },
]);

const selectedId = ref<string | undefined>(submissions.value[0]?.id);
const selected = computed(() => submissions.value.find(s => s.id === selectedId.value));

// Auto-select the first submission once real data loads.
watch(
  submissions,
  (next) => {
    if (!selectedId.value && next.length > 0) selectedId.value = next[0]!.id;
    else if (selectedId.value && !next.some(s => s.id === selectedId.value)) {
      selectedId.value = next[0]?.id;
    }
  },
  { immediate: true },
);

const approvalPct = computed<number>(() => {
  if (!selected.value) return 0;
  const { up, down } = selected.value;
  const total = up + down;
  return total === 0 ? 0 : Math.round((up / total) * 100);
});

const reviewerNote = ref("");

const bulk = reactive(new Set<string>());

function toggleBulk(id: string) {
  if (bulk.has(id)) bulk.delete(id);
  else bulk.add(id);
}

async function bulkApprove() {
  for (const id of bulk) await approve(id);
  bulk.clear();
}

async function bulkPlaytest() {
  for (const id of bulk) await sendToPlaytest(id);
  bulk.clear();
}

async function bulkReject() {
  for (const id of bulk) await reject(id);
  bulk.clear();
}

async function onApprove() {
  if (selected.value) await approve(selected.value.id);
}

async function onPlaytest() {
  if (selected.value) await sendToPlaytest(selected.value.id);
}

async function onReject() {
  if (selected.value) await reject(selected.value.id);
}
</script>

<style scoped>
.filter-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 14px;
  flex-wrap: wrap;
}

.bulk-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bulk-count {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: var(--ink-dim);
  letter-spacing: 0.1em;
}

.two-pane {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 18px;
  align-items: start;
}

@media (max-width: 1100px) {
  .two-pane { grid-template-columns: 1fr; }
}

.table tbody tr { cursor: pointer; }
.table tbody tr.selected { background: rgba(120, 200, 255, 0.06); }

.card-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mod-mini { font-size: 11px; padding: 6px 8px; }

.author-name {
  font-family: "Barlow Condensed", sans-serif;
  font-size: 12px;
  font-weight: 600;
}
.author-date {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  color: var(--ink-muted);
}

.vote-up { color: var(--accent-4); }
.vote-down { color: var(--ink-muted); margin-left: 6px; }

.row-more { color: var(--ink-muted); }

.detail-pane {
  position: sticky;
  top: 80px;
}

.detail-body {
  padding: 22px;
}

.card-frame {
  display: flex;
  justify-content: center;
  margin-bottom: 18px;
}

.big-card {
  width: 220px;
  min-height: 280px;
  padding: 18px;
  font-size: 17px;
  line-height: 1.18;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
}

.big-card-body { flex: 1; }

.big-card-footer {
  margin-top: 12px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.brand-mark {
  font-family: "Archivo Black", sans-serif;
  font-size: 8px;
  opacity: 0.6;
}

.pick-mark {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  opacity: 0.7;
}

.stat-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
  margin-bottom: 18px;
}

.stat-card {
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.015);
  text-align: center;
}

.stat-value {
  font-family: "Archivo Black", sans-serif;
  font-size: 18px;
}

.stat-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  color: var(--ink-muted);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-top: 2px;
}

.flag-warning {
  padding: 10px;
  border-radius: 8px;
  background: rgba(255, 90, 90, 0.06);
  border: 1px solid var(--danger);
  font-size: 12px;
  margin-bottom: 14px;
  color: var(--ink-dim);
}

.flag-warning-title {
  color: var(--danger);
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.15em;
}

.flag-warning-body {
  margin-top: 4px;
}

.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
}

.action-grid .btn {
  justify-content: center;
}

.author-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.author-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #5865f2, #8a4af3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Archivo Black", sans-serif;
  font-size: 11px;
}

.author-meta { flex: 1; }

.author-handle {
  font-family: "Archivo Black", sans-serif;
  font-size: 13px;
  text-transform: uppercase;
}

.author-stats {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  color: var(--ink-muted);
  letter-spacing: 0.1em;
  margin-top: 2px;
}
</style>
