<script setup lang="ts">
import { useNotifications } from "~/composables/useNotifications";
import {
  findPickMismatches,
  MAX_PICK,
  type PickMismatch,
} from "~/utils/pickMismatch";

definePageMeta({ middleware: "admin" });

interface BlackCardRow {
  id: string;
  text: string | null;
  pack: string | null;
  pick: number;
  active: boolean;
}

/** Stays well under set-pick's 1000-id cap. */
const FIX_CHUNK = 500;

const { $activityFetch } = useNuxtApp();
const { notify } = useNotifications();

const loading = ref(true);
const mismatches = ref<PickMismatch<BlackCardRow>[]>([]);
const savingId = ref<string | null>(null);
const fixingAll = ref(false);
const confirmFixAll = ref(false);

async function scan() {
  loading.value = true;
  confirmFixAll.value = false;
  try {
    const cards = await $activityFetch<BlackCardRow[]>("/api/admin/cards/list", {
      query: { type: "black" },
    });
    mismatches.value = findPickMismatches(cards);
  } catch (err) {
    console.error("[picks] scan failed:", err);
    notify({ title: "Scan Failed", description: "Could not load black cards", color: "error" });
  } finally {
    loading.value = false;
  }
}

function setPick(ids: string[], pick: number) {
  return $activityFetch("/api/admin/cards/set-pick", {
    method: "POST",
    body: { ids, pick },
  });
}

function dropFixed(ids: string[]) {
  const done = new Set(ids);
  mismatches.value = mismatches.value.filter((m) => !done.has(m.card.id));
}

// Any explicit choice clears the row, including keeping the current pick: an
// admin who leaves a two-blank card at pick 1 on purpose has answered the
// question. Nothing records that answer, so the card shows up again on the
// next scan.
async function fixOne(m: PickMismatch<BlackCardRow>, pick: number) {
  savingId.value = m.card.id;
  try {
    await setPick([m.card.id], pick);
    dropFixed([m.card.id]);
  } catch (err) {
    console.error("[picks] set-pick failed:", err);
    notify({ title: "Update Failed", description: "Could not change the pick", color: "error" });
  } finally {
    savingId.value = null;
  }
}

async function fixAll() {
  if (!confirmFixAll.value) {
    confirmFixAll.value = true;
    return;
  }
  fixingAll.value = true;

  const byPick = new Map<number, string[]>();
  for (const m of mismatches.value) {
    byPick.set(m.suggested, [...(byPick.get(m.suggested) ?? []), m.card.id]);
  }

  let fixed = 0;
  try {
    for (const [pick, ids] of byPick) {
      for (let i = 0; i < ids.length; i += FIX_CHUNK) {
        const chunk = ids.slice(i, i + FIX_CHUNK);
        await setPick(chunk, pick);
        fixed += chunk.length;
        dropFixed(chunk);
      }
    }
    notify({ title: "Picks Updated", description: `${fixed} cards fixed.`, color: "success" });
  } catch (err) {
    console.error("[picks] fix-all failed:", err);
    notify({
      title: "Update Stopped",
      description: `${fixed} cards were fixed before an error. The rest are still listed.`,
      color: "error",
    });
  } finally {
    fixingAll.value = false;
    confirmFixAll.value = false;
  }
}

/** Card text split so each blank can be drawn as one. */
function segments(text: string | null) {
  return (text ?? "")
    .split(/(_+)/)
    .filter(Boolean)
    .map((part) => ({ part, blank: part.startsWith("_") }));
}

onMounted(scan);
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-8">
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2 mb-1 text-sm text-slate-400">
      <NuxtLink to="/admin" class="hover:text-white transition-colors">Admin</NuxtLink>
      <UIcon name="i-solar-alt-arrow-right-linear" class="text-xs" />
      <NuxtLink to="/admin/cards" class="hover:text-white transition-colors">Card Manager</NuxtLink>
      <UIcon name="i-solar-alt-arrow-right-linear" class="text-xs" />
      <span class="text-white">Pick Mismatches</span>
    </div>

    <div class="flex flex-wrap items-end justify-between gap-4 mt-3 mb-6">
      <div>
        <h1 class="text-4xl font-bold tracking-tight">Pick Mismatches</h1>
        <p class="text-slate-400 mt-1">
          Black cards with two or more blanks whose pick count doesn't match
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-solar-refresh-bold-duotone"
          :loading="loading"
          :disabled="fixingAll"
          @click="scan"
        >
          Rescan
        </UButton>
        <template v-if="!loading && mismatches.length">
          <UButton
            v-if="confirmFixAll && !fixingAll"
            color="neutral"
            variant="ghost"
            @click="confirmFixAll = false"
          >
            Cancel
          </UButton>
          <UButton
            :color="confirmFixAll ? 'warning' : 'primary'"
            icon="i-solar-check-read-bold-duotone"
            :loading="fixingAll"
            @click="fixAll"
          >
            {{
              confirmFixAll
                ? `Set ${mismatches.length} cards to their blank count?`
                : `Fix all ${mismatches.length}`
            }}
          </UButton>
        </template>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <USkeleton v-for="i in 4" :key="i" class="h-20 rounded-xl" />
    </div>

    <!-- Empty -->
    <div
      v-else-if="!mismatches.length"
      class="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto"
    >
      <UIcon name="i-solar-check-circle-bold-duotone" class="text-6xl text-green-400 mb-4" />
      <h2 class="text-xl font-semibold">Every pick matches its blanks</h2>
      <p class="text-slate-400 text-sm mt-1">
        Cards with zero or one blank are never flagged, since a card like
        "Make a haiku." is legitimately pick 3.
      </p>
    </div>

    <!-- Mismatches -->
    <template v-else>
      <p class="text-sm text-slate-400 mb-3">
        <span class="text-slate-200 font-medium">{{ mismatches.length }}</span>
        {{ mismatches.length === 1 ? "card" : "cards" }} to review. Use a number to
        set the pick yourself, or accept the suggestion.
      </p>
      <TransitionGroup name="mismatch" tag="ul" class="space-y-3">
        <li
          v-for="m in mismatches"
          :key="m.card.id"
          class="mismatch-row rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4"
        >
          <div class="flex-1 min-w-0" :class="{ 'opacity-60': !m.card.active }">
            <p class="text-slate-100 leading-relaxed">
              <template v-for="(s, i) in segments(m.card.text)" :key="i">
                <span v-if="s.blank" class="mismatch-blank" aria-label="blank" />
                <template v-else>{{ s.part }}</template>
              </template>
            </p>
            <div class="flex flex-wrap items-center gap-2 mt-2 text-xs">
              <span class="text-amber-300 font-medium">
                {{ m.blanks }} blanks · pick {{ m.card.pick }}
              </span>
              <UBadge v-if="m.card.pack" color="info" variant="subtle" size="xs">
                {{ m.card.pack }}
              </UBadge>
              <UBadge v-if="!m.card.active" color="neutral" variant="subtle" size="xs">
                Disabled
              </UBadge>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <UFieldGroup size="sm">
              <UButton
                v-for="p in MAX_PICK"
                :key="p"
                color="neutral"
                :variant="p === m.card.pick ? 'solid' : 'outline'"
                :aria-label="`Set pick to ${p}`"
                :aria-pressed="p === m.card.pick"
                :disabled="savingId === m.card.id || fixingAll"
                @click="fixOne(m, p)"
              >
                {{ p }}
              </UButton>
            </UFieldGroup>
            <UButton
              size="sm"
              color="primary"
              :loading="savingId === m.card.id"
              :disabled="fixingAll"
              @click="fixOne(m, m.suggested)"
            >
              Set to {{ m.suggested }}
            </UButton>
          </div>
        </li>
      </TransitionGroup>
    </template>
  </div>
</template>

<style scoped>
.mismatch-row {
  background: rgba(51, 65, 85, 0.35);
  border: 1px solid rgba(100, 116, 139, 0.15);
}

.mismatch-blank {
  display: inline-block;
  width: 2.5em;
  margin: 0 0.2em;
  border-bottom: 2px solid rgb(252 211 77);
  vertical-align: baseline;
}

.mismatch-leave-active,
.mismatch-move {
  transition: all 0.3s ease;
}

.mismatch-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
</style>
