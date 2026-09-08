<script setup lang="ts">
definePageMeta({
  middleware: "admin",
});

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

interface IssueEvent {
  id: string;
  groupId: string;
  message: string;
  stack: string | null;
  lobbyCode: string | null;
  userId: string | null;
  appVersion: string;
  platform: string | null;
  route: string | null;
  context: Record<string, unknown> | null;
  createdAt: string;
}

const route = useRoute();
const { data } = await useFetch<{ group: IssueGroup; events: IssueEvent[] }>(
  `/api/admin/issues/${route.params.id}`,
);
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="flex items-center gap-3 mb-6">
      <NuxtLink
        to="/admin/issues"
        class="text-slate-400 hover:text-white transition-colors"
      >
        <UIcon name="i-solar-arrow-left-broken" class="text-xl" />
      </NuxtLink>
      <h1 class="text-2xl font-bold break-words">{{ data?.group?.title }}</h1>
    </div>

    <UCard class="mb-6">
      <dl class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <dt class="text-slate-500">Kind</dt>
          <dd>{{ data?.group?.kind }}</dd>
        </div>
        <div>
          <dt class="text-slate-500">Occurrences</dt>
          <dd>{{ data?.group?.eventCount }}</dd>
        </div>
        <div>
          <dt class="text-slate-500">First seen on</dt>
          <dd>v{{ data?.group?.firstAppVersion ?? "?" }}</dd>
        </div>
        <div>
          <dt class="text-slate-500">Status</dt>
          <dd>{{ data?.group?.status }}</dd>
        </div>
      </dl>
    </UCard>

    <h2 class="text-lg font-semibold mb-3">Recent occurrences</h2>
    <UCard v-for="ev in data?.events ?? []" :key="ev.id" class="mb-3">
      <p class="text-xs text-slate-500 mb-2">
        {{ new Date(ev.createdAt).toLocaleString() }} ·
        {{ ev.platform ?? "unknown" }} · v{{ ev.appVersion }}
        <template v-if="ev.lobbyCode"> · lobby {{ ev.lobbyCode }}</template>
      </p>
      <p class="font-mono text-sm break-words mb-2">{{ ev.message }}</p>
      <pre
        v-if="ev.context"
        class="text-xs bg-slate-800/50 rounded p-3 overflow-x-auto"
      >{{ JSON.stringify(ev.context, null, 2) }}</pre>
      <pre
        v-if="ev.stack"
        class="text-xs text-slate-400 mt-2 overflow-x-auto"
      >{{ ev.stack }}</pre>
    </UCard>
  </div>
</template>
