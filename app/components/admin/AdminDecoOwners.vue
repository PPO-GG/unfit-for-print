<script setup lang="ts">
/** Grant by name (not a pasted UUID) and see or revoke current owners. */
import { computed, onMounted, ref } from "vue";
import type { DecorationOwner } from "~/composables/useDecorationStudio";

defineProps<{ owners: DecorationOwner[] }>();
const emit = defineEmits<{ grant: [string]; revoke: [string] }>();

const { $activityFetch } = useNuxtApp();
const users = ref<{ id: string; name: string; avatarUrl: string | null }[]>([]);
const pick = ref<string | undefined>();

onMounted(async () => {
  try {
    users.value = await $activityFetch("/api/admin/users");
  } catch {
    users.value = [];
  }
});

const items = computed(() =>
  users.value.map((u) => ({ label: u.name, value: u.id, avatar: u.avatarUrl ? { src: u.avatarUrl } : undefined })),
);

function grant() {
  if (!pick.value) return;
  emit("grant", pick.value);
  pick.value = undefined;
}
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6">
    <div class="flex items-end gap-2">
      <label class="flex flex-1 flex-col gap-1 text-xs text-slate-400">Grant to a player
        <USelectMenu v-model="pick" :items="items" value-key="value" placeholder="Search players" />
      </label>
      <UButton color="success" :disabled="!pick" @click="grant">Grant</UButton>
    </div>

    <div>
      <h3 class="mb-2 text-sm font-semibold">{{ owners.length }} owner{{ owners.length === 1 ? "" : "s" }}</h3>
      <p v-if="owners.length === 0" class="text-sm text-slate-500">Nobody owns this yet.</p>
      <ul v-else class="divide-y divide-slate-800 rounded-lg border border-slate-800">
        <li v-for="o in owners" :key="o.userId" class="flex items-center gap-3 px-3 py-2">
          <UAvatar :src="o.avatarUrl ?? undefined" :alt="o.name" size="sm" />
          <span class="flex-1 truncate">{{ o.name }}</span>
          <UBadge size="sm" variant="subtle" :color="o.source === 'purchase' ? 'warning' : 'neutral'">{{ o.source }}</UBadge>
          <span class="w-24 text-right text-xs text-slate-500">{{ new Date(o.acquiredAt).toLocaleDateString() }}</span>
          <UButton size="xs" variant="ghost" color="error" @click="emit('revoke', o.userId)">Revoke</UButton>
        </li>
      </ul>
    </div>
  </div>
</template>
