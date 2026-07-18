<!--
  Open reports — card-level and user-behavior.
-->
<template>
  <div>
    <AdminPageHeader
      eyebrow="Operate · Reports"
      title="Open Reports"
      sub="User-flagged content and player behavior. Triage by priority."
    >
      <template #actions>
        <button class="btn ghost">Audit log</button>
      </template>
    </AdminPageHeader>

    <div class="filter-tabs mb-4">
      <button
        :class="['filter-tab', { active: tab === 'users' }]"
        @click="tab = 'users'"
      >
        Users <span class="count">{{ userReports.length }}</span>
      </button>
      <button
        :class="['filter-tab', { active: tab === 'cards' }]"
        @click="tab = 'cards'"
      >
        Cards <span class="count">{{ cardReports.length }}</span>
      </button>
    </div>

    <div v-if="tab === 'users'" class="panel fade-in">
      <table class="table">
        <thead>
          <tr>
            <th>User</th>
            <th>Reason</th>
            <th>Reporter</th>
            <th>Priority</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in userReports" :key="r.id">
            <td>
              <div class="target-name">{{ r.target }}</div>
              <div class="target-sub">
                {{ r.actions === 0
                  ? "No prior actions"
                  : `${r.actions} prior warning${r.actions > 1 ? "s" : ""}` }}
              </div>
            </td>
            <td class="reason-cell">{{ r.reason }}</td>
            <td><span class="reporter">@{{ r.reporter }}</span></td>
            <td><AdminStatusPill :variant="r.priority">{{ r.priority }}</AdminStatusPill></td>
            <td><span class="date">{{ r.date }}</span></td>
            <td>
              <div class="actions">
                <button class="btn sm ghost" @click="dismissUserReport(r.id)">Dismiss</button>
                <button class="btn sm">Warn</button>
                <button class="btn sm danger">Ban</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="tab === 'cards'" class="panel fade-in">
      <table class="table">
        <thead>
          <tr>
            <th>Card</th>
            <th>Reason</th>
            <th>Reporter</th>
            <th>Priority</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in cardReports" :key="r.id">
            <td>
              <div class="card-cell">
                <AdminKindPill :kind="r.kind">{{ r.kind === "prompt" ? "P" : "A" }}</AdminKindPill>
                <AdminCardMini :kind="r.kind" class="report-mini">{{ r.target }}</AdminCardMini>
              </div>
            </td>
            <td class="reason-cell">{{ r.reason }}</td>
            <td><span class="reporter">@{{ r.reporter }}</span></td>
            <td><AdminStatusPill :variant="r.priority">{{ r.priority }}</AdminStatusPill></td>
            <td><span class="date">{{ r.date }}</span></td>
            <td>
              <div class="actions">
                <button class="btn sm ghost" @click="dismissCardReport(r.id)">Dismiss</button>
                <button class="btn sm">Edit</button>
                <button class="btn sm danger">Remove</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "admin",
});

const { cardReports, userReports, dismissCardReport, dismissUserReport } = useAdminReports();

const tab = ref<"users" | "cards">("users");
</script>

<style scoped>
.target-name {
  font-family: "Archivo Black", sans-serif;
  font-size: 13px;
  text-transform: uppercase;
}

.target-sub {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  color: var(--ink-muted);
  margin-top: 2px;
}

.reason-cell {
  max-width: 360px;
}

.reporter {
  font-family: "Barlow Condensed", sans-serif;
  font-size: 12px;
}

.date {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  color: var(--ink-muted);
}

.actions {
  display: flex;
  gap: 6px;
}

.card-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.report-mini {
  font-size: 11px;
  padding: 5px 8px;
}
</style>
