<script setup lang="ts">
/**
 * Many cards at once: only the fields that make sense in bulk. Text is never
 * editable here — narrow to one card for that.
 */
import { computed, ref, watch } from "vue";
import type { AdminCard } from "~/types/adminCard";
import { sharedValue } from "~/utils/bulkField";

type TriState = "on" | "off" | "mixed";

const props = defineProps<{ cards: AdminCard[]; packs: string[]; busy?: boolean }>();
const emit = defineEmits<{
  apply: [{ pack?: string; active?: boolean; pick?: number }];
  delete: [];
  narrow: [id: string];
  drop: [id: string];
}>();

const LIST_CAP = 50;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

const packShared = computed(() => sharedValue(props.cards, (c) => c.pack ?? ""));
const activeShared = computed(() => sharedValue(props.cards, (c) => c.active !== false));
const allBlack = computed(() => props.cards.length > 0 && props.cards.every((c) => c.type === "black"));
const pickShared = computed(() => sharedValue(props.cards, (c) => c.pick ?? 1));

const initialActive = (): TriState =>
  activeShared.value.state === "same" ? (activeShared.value.value ? "on" : "off") : "mixed";
const initialPick = () => (pickShared.value.state === "same" ? pickShared.value.value : null);

const pack = ref("");
const active = ref<TriState>(initialActive());
const pick = ref<number | null>(initialPick());

function reseed() {
  pack.value = "";
  active.value = initialActive();
  pick.value = initialPick();
}
watch(() => props.cards.map((c) => c.id).join(","), reseed);

const packPlaceholder = computed(() => {
  if (packShared.value.state === "same") return packShared.value.value || "No pack";
  const names = [...new Set(props.cards.map((c) => c.pack ?? "No pack"))];
  const shown = names.slice(0, 3).join(", ") + (names.length > 3 ? "…" : "");
  return `${shown} — choose to move all`;
});

const changes = computed(() => {
  const out: { pack?: string; active?: boolean; pick?: number } = {};
  if (pack.value.trim()) out.pack = pack.value.trim();
  if (active.value !== initialActive() && active.value !== "mixed") out.active = active.value === "on";
  if (allBlack.value && pick.value !== null && pick.value !== initialPick()) out.pick = pick.value;
  return out;
});
const dirty = computed(() => Object.keys(changes.value).length > 0);

const counts = computed(() => {
  const white = props.cards.filter((c) => c.type === "white").length;
  const packsCount = new Set(props.cards.map((c) => c.packId)).size;
  return `${white} white · ${props.cards.length - white} black · ${plural(packsCount, "pack")}`;
});

defineExpose({ dirty });
</script>

<template>
  <div class="flex flex-col gap-3">
    <div>
      <p class="text-lg font-semibold text-slate-100">{{ plural(cards.length, "card") }}</p>
      <p class="text-xs text-slate-400">{{ counts }}</p>
    </div>

    <UFormField label="Pack">
      <AdminPackPicker v-model="pack" :packs="packs" label="" :placeholder="packPlaceholder" />
    </UFormField>

    <UFormField label="Status">
      <div class="inline-flex rounded-md border border-slate-700 overflow-hidden text-xs">
        <button type="button" data-testid="bulk-status-on" class="px-2 py-1" :class="active === 'on' ? 'bg-primary-600 text-white' : ''" @click="active = 'on'">Active</button>
        <span v-if="initialActive() === 'mixed'" data-testid="bulk-status-mixed" class="px-2 py-1 text-slate-400" :class="active === 'mixed' ? 'bg-slate-700' : ''">Mixed</span>
        <button type="button" data-testid="bulk-status-off" class="px-2 py-1" :class="active === 'off' ? 'bg-primary-600 text-white' : ''" @click="active = 'off'">Disabled</button>
      </div>
    </UFormField>

    <UFormField v-if="allBlack" label="Pick">
      <div class="inline-flex rounded-md border border-slate-700 overflow-hidden text-xs">
        <span v-if="pickShared.state === 'mixed' && pick === null" class="px-2 py-1 text-slate-400 bg-slate-700">Mixed</span>
        <button
          v-for="n in [1, 2, 3]"
          :key="n"
          type="button"
          :data-testid="`bulk-pick-${n}`"
          class="px-2 py-1"
          :class="pick === n ? 'bg-primary-600 text-white' : ''"
          @click="pick = n"
        >
          {{ n }}
        </button>
      </div>
    </UFormField>

    <div>
      <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Selected</p>
      <ul class="max-h-64 overflow-y-auto">
        <li v-for="c in cards.slice(0, LIST_CAP)" :key="c.id" :data-testid="`bulk-card-${c.id}`" class="flex items-center gap-1 text-xs py-0.5">
          <button type="button" data-testid="narrow" class="truncate flex-1 text-left hover:text-white text-slate-300" @click="emit('narrow', c.id)">
            {{ c.imageKey ? "🖼 Image" : c.text }}
          </button>
          <button type="button" data-testid="drop" class="text-slate-500 hover:text-red-300" aria-label="Remove from selection" @click="emit('drop', c.id)">✕</button>
        </li>
      </ul>
      <p v-if="cards.length > LIST_CAP" class="text-xs text-slate-500">+ {{ cards.length - LIST_CAP }} more</p>
    </div>

    <div class="flex gap-2">
      <UButton size="xs" color="primary" data-testid="bulk-apply" :disabled="!dirty" :loading="busy" @click="emit('apply', changes)">
        Apply to {{ cards.length }}
      </UButton>
      <span class="flex-1" />
      <UButton size="xs" color="error" variant="ghost" @click="emit('delete')">Delete {{ cards.length }}</UButton>
    </div>
  </div>
</template>
