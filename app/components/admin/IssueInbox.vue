<script setup lang="ts">
import { useNotifications } from "~/composables/useNotifications";

interface IssueGroup {
  id: string;
  fingerprint: string;
  kind: string;
  title: string;
  status: string;
  eventCount: number;
  firstSeen: string;
  lastSeen: string;
  firstAppVersion: string | null;
  notifiedAt: string | null;
}

const { notify } = useNotifications();

/**
 * Reka UI — the Select primitive under Nuxt UI v4 — throws outright on an
 * item whose value is the empty string, because it reserves "" for clearing
 * the selection. So "All" carries a sentinel instead.
 *
 * The sentinel must never reach the API: /api/admin/issues validates `kind`
 * and `status` against allowlists and 400s on anything outside them. Mapping
 * it to undefined makes useFetch omit the parameter entirely, which is what
 * the route reads as "no filter".
 */
const ALL = "all";

const kind = ref<string>(ALL);
const status = ref<string>("open");

const query = computed(() => ({
  kind: kind.value === ALL ? undefined : kind.value,
  status: status.value === ALL ? undefined : status.value,
}));

const { data, refresh, pending } = await useFetch<{ groups: IssueGroup[] }>(
  "/api/admin/issues",
  { query },
);

const kindOptions = [
  { label: "All kinds", value: ALL },
  { label: "Client error", value: "client-error" },
  { label: "API error", value: "api-error" },
  { label: "Player report", value: "player-report" },
  { label: "Anomaly", value: "anomaly" },
  { label: "Server error", value: "server-error" },
];

const statusOptions = [
  { label: "Open", value: "open" },
  { label: "Resolved", value: "resolved" },
  { label: "Muted", value: "muted" },
  { label: "All", value: ALL },
];

async function setStatus(id: string, next: string) {
  // An unhandled rejection here would be caught by this branch's own client
  // capture plugin and filed as a brand-new issue group — a status-update
  // failure feeding back into the very inbox reporting it.
  try {
    await $fetch("/api/admin/issues/status", {
      method: "POST",
      body: { id, status: next },
    });
    await refresh();
  } catch (err: any) {
    const msg = err?.data?.statusMessage || err?.data?.message || err?.message || "Could not update issue status";
    console.error("[IssueInbox] setStatus failed:", msg, err);
    notify({ title: "Update Failed", description: msg, color: "error" });
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap gap-3">
      <USelect v-model="kind" :items="kindOptions" value-key="value" class="w-48" />
      <USelect v-model="status" :items="statusOptions" value-key="value" class="w-40" />
      <UButton
        icon="i-solar-refresh-broken"
        variant="subtle"
        :loading="pending"
        @click="refresh()"
      >
        Refresh
      </UButton>
    </div>

    <p v-if="!data?.groups?.length" class="text-slate-400 py-8 text-center">
      Nothing here. That is the good outcome.
    </p>

    <UCard v-for="group in data?.groups ?? []" :key="group.id">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <UBadge size="sm" variant="subtle">{{ group.kind }}</UBadge>
            <UBadge
              size="sm"
              :color="group.status === 'open' ? 'warning' : 'neutral'"
              variant="subtle"
            >
              {{ group.status }}
            </UBadge>
            <span class="text-slate-500 text-xs">
              {{ group.eventCount }}× · first seen v{{ group.firstAppVersion ?? "?" }}
            </span>
          </div>
          <NuxtLink
            :to="`/admin/issues/${group.id}`"
            class="font-medium hover:text-amber-300 transition-colors break-words"
          >
            {{ group.title }}
          </NuxtLink>
          <p class="text-slate-500 text-xs mt-1">
            Last seen {{ new Date(group.lastSeen).toLocaleString() }}
          </p>
        </div>
        <div class="flex gap-2 flex-shrink-0">
          <UButton
            v-if="group.status !== 'open'"
            size="xs"
            variant="subtle"
            color="primary"
            @click="setStatus(group.id, 'open')"
          >
            Reopen
          </UButton>
          <UButton
            v-if="group.status !== 'resolved'"
            size="xs"
            variant="subtle"
            @click="setStatus(group.id, 'resolved')"
          >
            Resolve
          </UButton>
          <UButton
            v-if="group.status !== 'muted'"
            size="xs"
            variant="subtle"
            color="neutral"
            @click="setStatus(group.id, 'muted')"
          >
            Mute
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
