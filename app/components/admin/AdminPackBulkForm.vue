<script setup lang="ts">
/** Many packs at once: series, the four flags, merge, delete. */
import { computed, reactive, watch } from "vue";
import type { AdminPack } from "~/types/adminCard";
import { sharedValue } from "~/utils/bulkField";
import { isPackDisabled, packTotal } from "~/utils/packListView";

type TriState = "on" | "off" | "mixed";
type Flag = "active" | "isDefault" | "official" | "nsfw";

const props = defineProps<{ packs: AdminPack[]; busy?: boolean }>();
const emit = defineEmits<{
  apply: [{ series?: string; active?: boolean; isDefault?: boolean; official?: boolean; nsfw?: boolean }];
  merge: [];
  delete: [];
  narrow: [id: string];
  drop: [id: string];
}>();

const FLAGS: { key: Flag; label: string; testid: string }[] = [
  { key: "active", label: "Enabled", testid: "active" },
  { key: "isDefault", label: "Default", testid: "default" },
  { key: "official", label: "Official", testid: "official" },
  { key: "nsfw", label: "NSFW", testid: "nsfw" },
];

const getFlag = (p: AdminPack, k: Flag) => (k === "active" ? !isPackDisabled(p) : p[k]);
const tri = (k: Flag): TriState => {
  const s = sharedValue(props.packs, (p) => getFlag(p, k));
  return s.state === "same" ? (s.value ? "on" : "off") : "mixed";
};
const seriesShared = computed(() => sharedValue(props.packs, (p) => p.series ?? ""));

const initial = () => ({
  series: seriesShared.value.state === "same" ? seriesShared.value.value : "",
  active: tri("active"),
  isDefault: tri("isDefault"),
  official: tri("official"),
  nsfw: tri("nsfw"),
});
const state = reactive(initial());
// Keyed on more than just the id list — see AdminCardBulkForm's reseed watch
// for why: a reload after a bulk apply keeps the same ids but new values.
watch(
  () => props.packs.map((p) => [p.id, p.series ?? "", ...FLAGS.map((f) => getFlag(p, f.key))].join("|")).join(","),
  () => Object.assign(state, initial()),
);

const changes = computed(() => {
  const base = initial();
  const out: { series?: string; active?: boolean; isDefault?: boolean; official?: boolean; nsfw?: boolean } = {};
  if (state.series.trim() !== base.series) out.series = state.series.trim();
  for (const { key } of FLAGS) {
    if (state[key] !== base[key] && state[key] !== "mixed") out[key] = state[key] === "on";
  }
  return out;
});
const dirty = computed(() => Object.keys(changes.value).length > 0);
const totalCards = computed(() => props.packs.reduce((n, p) => n + packTotal(p), 0));

defineExpose({ dirty });
</script>

<template>
  <div class="flex flex-col gap-3">
    <div>
      <p class="text-lg font-semibold text-slate-100">{{ packs.length }} packs</p>
      <p class="text-xs text-slate-400">{{ totalCards.toLocaleString() }} cards</p>
    </div>

    <UFormField label="Series / brand">
      <UInput v-model="state.series" class="w-full" :placeholder="seriesShared.state === 'mixed' ? 'Mixed' : 'e.g. Cards Against Humanity'" />
    </UFormField>

    <div v-for="f in FLAGS" :key="f.key" class="flex items-center justify-between text-xs">
      <span class="text-slate-300">{{ f.label }}</span>
      <div class="inline-flex rounded-md border border-slate-700 overflow-hidden">
        <button type="button" :data-testid="`bulk-${f.testid}-on`" class="px-2 py-0.5" :class="state[f.key] === 'on' ? 'bg-primary-600 text-white' : ''" @click="state[f.key] = 'on'">Yes</button>
        <span v-if="initial()[f.key] === 'mixed'" :data-testid="`bulk-${f.testid}-mixed`" class="px-2 py-0.5 text-slate-400" :class="state[f.key] === 'mixed' ? 'bg-slate-700' : ''">Mixed</span>
        <button type="button" :data-testid="`bulk-${f.testid}-off`" class="px-2 py-0.5" :class="state[f.key] === 'off' ? 'bg-primary-600 text-white' : ''" @click="state[f.key] = 'off'">No</button>
      </div>
    </div>

    <ul class="max-h-48 overflow-y-auto">
      <li v-for="p in packs" :key="p.id" :data-testid="`bulk-pack-${p.id}`" class="flex items-center gap-1 text-xs py-0.5">
        <button type="button" data-testid="narrow" class="truncate flex-1 text-left text-slate-300 hover:text-white" @click="emit('narrow', p.id)">{{ p.name }}</button>
        <button type="button" data-testid="drop" class="text-slate-500 hover:text-red-300" aria-label="Remove from selection" @click="emit('drop', p.id)">✕</button>
      </li>
    </ul>

    <div class="flex gap-2 flex-wrap">
      <UButton size="xs" color="primary" data-testid="bulk-apply" :disabled="!dirty" :loading="busy" @click="emit('apply', changes)">Apply</UButton>
      <UButton size="xs" variant="soft" data-testid="bulk-merge" @click="emit('merge')">Merge into…</UButton>
      <span class="flex-1" />
      <UButton size="xs" color="error" variant="ghost" @click="emit('delete')">Delete {{ packs.length }}</UButton>
    </div>
  </div>
</template>
