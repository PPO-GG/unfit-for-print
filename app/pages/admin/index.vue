<!--
  Admin overview — mission-control dashboard.

  Replaces the old UCard-based admin landing page. Uses the new `admin`
  layout which provides the sidebar + top bar shell.
-->
<template>
  <div>
    <AdminPageHeader
      eyebrow="Operate · Today"
      title="Mission Control"
      sub="What's happening across Unfit For Print right now."
    >
      <template #actions>
        <NuxtLink to="/" class="btn ghost">
          <AdminIcon name="external" />
          View public site
        </NuxtLink>
        <NuxtLink to="/admin/announcements" class="btn primary">
          <AdminIcon name="plus" />
          New Announcement
        </NuxtLink>
      </template>
    </AdminPageHeader>

    <!-- KPI grid -->
    <div class="kpi-grid">
      <AdminKpiTile
        v-for="kpi in kpis"
        :key="kpi.id"
        :kpi="kpi"
        :spark-data="sparks[kpi.id] ?? []"
      />
    </div>

    <!-- Two-column: activity + attention panels -->
    <div class="grid-2 mt-6">
      <div class="panel">
        <div class="panel-header">
          <div>
            <div class="panel-eyebrow">Live · last 24h</div>
            <div class="panel-title">Activity Feed</div>
          </div>
          <div class="filter-tabs">
            <button
              v-for="f in activityFilters"
              :key="f.id"
              :class="['filter-tab', { active: activityFilter === f.id }]"
              @click="activityFilter = f.id"
            >{{ f.label }}</button>
          </div>
        </div>
        <div>
          <div v-for="(a, i) in activity" :key="i" class="activity-row">
            <span :class="['activity-dot', a.color]" />
            <div class="activity-text">
              <span class="who">{{ a.who }}</span>
              <span class="what">{{ a.what }}</span>
              <span class="target">{{ a.target }}</span>
            </div>
            <span class="activity-time">{{ a.time }}</span>
          </div>
        </div>
      </div>

      <div class="attention-column">
        <!-- Action items -->
        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="panel-eyebrow">Needs your attention</div>
              <div class="panel-title">Action Items</div>
            </div>
            <span class="pending-count">{{ actionItems.length }} PENDING</span>
          </div>
          <div class="action-items-body">
            <NuxtLink
              v-for="item in actionItems"
              :key="item.label"
              :to="item.to"
              class="activity-row action-item-row"
            >
              <div :class="['action-item-badge', item.color]">{{ item.count }}</div>
              <div class="action-item-label">{{ item.label }}</div>
              <AdminIcon name="external" :size="11" class="action-item-chev" />
            </NuxtLink>
          </div>
        </div>

        <!-- System health -->
        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="panel-eyebrow">Infra · realtime</div>
              <div class="panel-title">System Health</div>
            </div>
            <span class="status-pill live">
              <span class="health-dot" />ALL GREEN
            </span>
          </div>
          <div class="health-body">
            <div v-for="row in health" :key="row.label" class="health-row">
              <span
                class="health-row-dot"
                :style="{
                  background: row.warn ? 'var(--accent)' : 'var(--accent-4)',
                  boxShadow: `0 0 6px ${row.warn ? 'var(--accent)' : 'var(--accent-4)'}`,
                }"
              />
              <div>
                <div class="health-label">{{ row.label }}</div>
                <div class="health-sub">{{ row.sub }}</div>
              </div>
              <div :class="['health-value', { warn: row.warn }]">{{ row.value }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Revenue + top servers -->
    <div class="grid-2 mt-6">
      <div class="panel revenue-panel">
        <div class="revenue-head">
          <div>
            <div class="panel-eyebrow">Revenue · last 7 days</div>
            <div class="panel-title">{{ revenue.total }}</div>
          </div>
          <span class="kpi-trend">
            <AdminIcon name="arrow_up" :size="11" />
            {{ revenue.trend }}
          </span>
        </div>
        <div class="revenue-bars">
          <div v-for="(v, i) in revenue.daily" :key="i" class="revenue-col">
            <div
              class="revenue-bar"
              :class="{ latest: i === revenue.daily.length - 1 }"
              :style="{ height: `${(v / revenueMax) * 100}%` }"
            >
              <div class="revenue-bar-label">${{ (v / 1000).toFixed(1) }}k</div>
            </div>
            <div class="revenue-day">{{ revenue.dayLabels[i] }}</div>
          </div>
        </div>
        <div class="divider" />
        <div class="revenue-breakdown">
          <div v-for="b in revenue.breakdown" :key="b.label">
            <div class="mini-stat-label">{{ b.label }}</div>
            <div class="mini-stat-value">{{ b.value }}</div>
            <div class="mini-stat-sub">{{ b.sub }}</div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <div class="panel-eyebrow">Where the games are</div>
            <div class="panel-title">Top Servers (24h)</div>
          </div>
          <button type="button" class="btn sm ghost">View all</button>
        </div>
        <div>
          <div v-for="(s, i) in topServers" :key="s.name" class="activity-row server-row">
            <span class="server-rank">{{ i + 1 }}</span>
            <div>
              <div class="server-name">{{ s.name }}</div>
              <div class="server-members">{{ s.members }} members</div>
            </div>
            <div class="server-games">{{ s.games }} games</div>
            <span :class="['kpi-trend', { down: s.trend.startsWith('−') }]">{{ s.trend }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "admin",
});

const { kpis, sparks, activity, actionItems, health, revenue, topServers } = useAdminOverview();

const activityFilter = ref<"all" | "mod" | "cards" | "users">("all");
const activityFilters = [
  { id: "all", label: "All" },
  { id: "mod", label: "Mod" },
  { id: "cards", label: "Cards" },
  { id: "users", label: "Users" },
] as const;

const revenueMax = computed(() => Math.max(...revenue.value.daily));
</script>

<style scoped>
.attention-column {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.pending-count {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  color: var(--ink-muted);
  letter-spacing: 0.15em;
}

.action-items-body {
  padding: 4px;
}

.action-item-row {
  border-radius: 8px;
  margin: 2px 6px;
  border-bottom: none !important;
}

.action-item-badge {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--line-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Archivo Black", sans-serif;
  font-size: 12px;
}
.action-item-badge.danger { color: var(--danger); }
.action-item-badge.yellow { color: var(--accent); }
.action-item-badge.cyan { color: var(--accent-3); }
.action-item-badge.lime { color: var(--accent-4); }
.action-item-badge.pink { color: var(--accent-2); }

.action-item-label {
  font-family: "Barlow Condensed", sans-serif;
  font-size: 13px;
  color: var(--ink);
}

.action-item-chev { color: var(--ink-muted); }

.health-dot {
  width: 6px;
  height: 6px;
  border-radius: 99px;
  background: var(--accent-4);
  box-shadow: 0 0 6px var(--accent-4);
}

.health-body {
  padding: 6px 0;
}

.health-row {
  display: grid;
  grid-template-columns: 10px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 9px 18px;
  border-bottom: 1px solid var(--line);
}
.health-row:last-child { border-bottom: none; }

.health-row-dot {
  width: 8px;
  height: 8px;
  border-radius: 99px;
}

.health-label {
  font-family: "Barlow Condensed", sans-serif;
  font-size: 13px;
  font-weight: 600;
}

.health-sub {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  color: var(--ink-muted);
  letter-spacing: 0.12em;
  margin-top: 2px;
}

.health-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: var(--ink-dim);
}
.health-value.warn { color: var(--accent); }

.revenue-panel { padding: 20px; }

.revenue-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.revenue-bars {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 130px;
  margin-top: 18px;
  padding-bottom: 4px;
}

.revenue-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  height: 100%;
  justify-content: flex-end;
}

.revenue-bar {
  width: 100%;
  background: linear-gradient(180deg, var(--accent-3) 0%, oklch(60% 0.20 195) 100%);
  border-radius: 4px 4px 0 0;
  position: relative;
}
.revenue-bar.latest {
  background: linear-gradient(180deg, var(--accent) 0%, oklch(70% 0.18 90) 100%);
}

.revenue-bar-label {
  position: absolute;
  top: -16px;
  left: 50%;
  transform: translateX(-50%);
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  color: var(--ink-dim);
  white-space: nowrap;
}

.revenue-day {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  color: var(--ink-muted);
}

.revenue-breakdown {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
}

.mini-stat-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  color: var(--ink-muted);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.mini-stat-value {
  font-family: "Archivo Black", sans-serif;
  font-size: 18px;
  margin-top: 4px;
}

.mini-stat-sub {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  color: var(--ink-muted);
  margin-top: 2px;
}

.server-row {
  grid-template-columns: 24px 1fr auto auto;
}

.server-rank {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: var(--ink-muted);
}

.server-name {
  font-family: "Archivo Black", sans-serif;
  font-size: 13px;
  text-transform: uppercase;
}

.server-members {
  font-family: "JetBrains Mono", monospace;
  font-size: 9.5px;
  color: var(--ink-muted);
  letter-spacing: 0.12em;
  margin-top: 2px;
}

.server-games {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: var(--ink-dim);
}
</style>
