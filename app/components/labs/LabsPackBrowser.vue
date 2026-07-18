<!--
  Card pack browser — sidebar of packs + detail pane with a sample
  grid of pack cards.

  Wired (real): pack list + per-type card counts + per-pack card
  previews pull from the live `whiteCard` / `blackCard` collections
  (same source as `/admin/cards/browse`).

  Stubbed (schema has no storage): rating, play count, blurb, vibe,
  NEW / LAB ORIGIN flags. The "Play with this pack" CTA is visible
  but disabled until lobby creation exposes a pack selector. See
  future-features doc § Labs — Card packs system.
-->
<template>
  <div>
    <!-- Loading the full pack list -->
    <div
      v-if="loading && packs.length === 0"
      class="flex items-center justify-center py-12"
    >
      <UIcon
        name="i-svg-spinners-ring-resize"
        class="text-3xl"
        :style="{ color: 'var(--accent-lime)' }"
      />
    </div>

    <div
      v-else-if="packs.length === 0"
      class="labs-panel p-12 text-center"
    >
      <div
        class="font-display uppercase mb-2"
        :style="{ fontSize: '22px', color: 'var(--ink-dim)' }"
      >
        No packs yet
      </div>
      <div
        class="font-cond"
        :style="{ fontSize: '15px', color: 'var(--ink-muted)' }"
      >
        Packs appear here once cards are added via the admin tools.
      </div>
    </div>

    <div v-else class="grid grid-cols-12 gap-4">
      <!-- Sidebar -->
      <div
        class="col-span-12 md:col-span-4 lg:col-span-3 labs-panel p-3 self-start"
        style="position: sticky; top: 80px"
      >
        <div class="flex items-center justify-between mb-3 px-2 pt-1">
          <div
            class="font-display uppercase"
            :style="{
              fontSize: '12px',
              letterSpacing: '0.15em',
              color: 'var(--ink)',
            }"
          >
            Packs ({{ packs.length }})
          </div>
        </div>
        <div
          class="flex flex-col gap-1 max-h-[600px] overflow-y-auto pr-1"
        >
          <button
            v-for="p in packs"
            :key="p.id"
            type="button"
            class="pack-list-row"
            :class="{ selected: selectedId === p.id }"
            :style="{ ['--pack-color' as string]: p.color }"
            @click="onSelect(p)"
          >
            <span class="pack-dot" />
            <span class="name">{{ p.name }}</span>
            <span class="count">{{ p.cards }}</span>
            <span
              v-if="p.new"
              class="labs-chip lime"
              :style="{ fontSize: '8px', padding: '2px 5px' }"
            >NEW</span>
          </button>
        </div>
      </div>

      <!-- Detail pane -->
      <div
        v-if="selectedPack"
        class="col-span-12 md:col-span-8 lg:col-span-9 flex flex-col gap-4"
      >
        <!-- Header -->
        <div
          class="labs-panel p-5 relative overflow-hidden"
          :style="{
            borderColor: `color-mix(in oklch, ${selectedPack.color} 40%, var(--line-strong))`,
          }"
        >
          <div
            :style="{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: selectedPack.color,
            }"
          />
          <div class="flex items-start gap-4 flex-wrap">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-2 flex-wrap">
                <div v-if="selectedPack.official" class="labs-chip cyan">
                  OFFICIAL
                </div>
                <div v-if="selectedPack.source === 'labs'" class="labs-chip lime">
                  <LabsIcon name="beaker" :size="10" /> LAB ORIGIN
                </div>
                <div v-if="selectedPack.new" class="labs-chip yellow">NEW</div>
                <div class="labs-chip">{{ selectedPack.vibe.toUpperCase() }}</div>
              </div>
              <h2
                class="font-display uppercase leading-none"
                :style="{ fontSize: '28px', color: 'var(--ink)' }"
              >
                {{ selectedPack.name }}
              </h2>
              <div
                v-if="selectedPack.desc"
                class="font-cond mt-2 max-w-xl"
                :style="{
                  fontSize: '15px',
                  color: 'var(--ink-dim)',
                  textWrap: 'pretty',
                }"
              >
                {{ selectedPack.desc }}
              </div>
              <div
                class="flex items-center gap-3 mt-3 font-mono uppercase flex-wrap"
                :style="{
                  fontSize: '10px',
                  letterSpacing: '0.2em',
                  color: 'var(--ink-muted)',
                }"
              >
                <span v-if="selectedPack.rating > 0">
                  <span :style="{ color: 'var(--accent-yellow)' }">★</span>
                  {{ selectedPack.rating }}/5
                </span>
                <span v-if="selectedPack.rating > 0 && selectedPack.plays > 0">·</span>
                <span v-if="selectedPack.plays > 0">
                  {{ selectedPack.plays.toLocaleString() }} plays
                </span>
                <span
                  v-if="(selectedPack.rating > 0 || selectedPack.plays > 0)"
                >·</span>
                <span>
                  {{ selectedPack.cards }} cards ·
                  {{ selectedPack.white }} white ·
                  {{ selectedPack.black }} black
                </span>
              </div>
            </div>
            <button
              class="labs-btn primary"
              disabled
              title="Pack selection at lobby creation coming soon"
            >
              <LabsIcon name="play" :size="14" /> Play with this pack
            </button>
          </div>
        </div>

        <!-- Card filter -->
        <div class="flex items-center gap-3 flex-wrap">
          <div class="seg">
            <button
              v-for="f in CARD_FILTERS"
              :key="f.id"
              type="button"
              :class="{ active: cardFilter === f.id }"
              @click="cardFilter = f.id"
            >
              {{ f.label }}
            </button>
          </div>
          <div
            class="font-mono uppercase"
            :style="{
              fontSize: '10px',
              letterSpacing: '0.2em',
              color: 'var(--ink-muted)',
            }"
          >
            Showing {{ filteredCards.length }} of {{ selectedPack.cards }} cards
            (preview)
          </div>
        </div>

        <!-- Card grid -->
        <div
          v-if="cardsLoading"
          class="flex items-center justify-center py-8"
        >
          <UIcon
            name="i-svg-spinners-ring-resize"
            class="text-2xl"
            :style="{ color: 'var(--accent-lime)' }"
          />
        </div>
        <div
          v-else
          class="pack-card-grid"
        >
          <LabsCahCard
            v-for="(c, i) in filteredCards"
            :key="i"
            :kind="c.kind"
            :text="c.text"
            size="sm"
          />
        </div>
        <div
          v-if="!cardsLoading"
          class="text-center font-mono uppercase pt-3"
          :style="{
            fontSize: '10px',
            letterSpacing: '0.2em',
            color: 'var(--ink-muted)',
          }"
        >
          Showing {{ filteredCards.length }} preview cards · play to see
          all {{ selectedPack.cards }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LabsPack, LabsPackCard } from "~/types/labs";

const props = defineProps<{
  packs: LabsPack[];
  packCards: Record<string, LabsPackCard[]>;
  loading?: boolean;
  loadingCardsFor?: string | null;
}>();

const emit = defineEmits<{
  selectPack: [pack: LabsPack];
}>();

const selectedId = ref<string>("");
const cardFilter = ref<"all" | "black" | "white">("all");

const CARD_FILTERS = [
  { id: "all" as const, label: "All" },
  { id: "black" as const, label: "Prompts" },
  { id: "white" as const, label: "Answers" },
];

// Auto-select the first pack once data arrives.
watch(
  () => props.packs,
  (list) => {
    if (list.length && !selectedId.value) {
      const first = list[0]!;
      selectedId.value = first.id;
      emit("selectPack", first);
    }
  },
  { immediate: true },
);

function onSelect(pack: LabsPack) {
  selectedId.value = pack.id;
  emit("selectPack", pack);
}

const selectedPack = computed(() =>
  props.packs.find((p) => p.id === selectedId.value) ?? null,
);

const cardsLoading = computed(
  () =>
    Boolean(props.loadingCardsFor) &&
    props.loadingCardsFor === selectedId.value,
);

const filteredCards = computed<LabsPackCard[]>(() => {
  const all = props.packCards[selectedId.value] ?? [];
  if (cardFilter.value === "all") return all;
  if (cardFilter.value === "black") return all.filter((c) => c.kind === "prompt");
  return all.filter((c) => c.kind === "answer");
});
</script>

<style scoped>
/**
 * Auto-fill grid — packs as many cards as will fit at the target
 * minimum width, then spreads each column to `1fr` so rows align.
 * `justify-items: center` keeps cards visually centered in their
 * column (a card-scaler renders its own internal width clamp).
 */
.pack-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  justify-items: center;
  align-items: start;
}
</style>
