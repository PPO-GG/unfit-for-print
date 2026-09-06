<template>
  <div>
    <!-- ── Pack gallery ─────────────────────────────────────────────── -->
    <template v-if="!selectedPack">
      <div class="labs-feed-heading">
        <div>
          <p class="labs-eyebrow">{{ t("labs.packs_eyebrow") }}</p>
          <h2>{{ t("labs.packs_title") }}</h2>
        </div>
        <p>
          {{ t("labs.pack_count", visiblePacks.length) }} ·
          {{ t("labs.card_count", visibleCards) }}
        </p>
      </div>

      <div class="labs-controls">
        <div class="labs-filter-group" :aria-label="t('labs.packs_title')">
          <button
            :class="{ active: !defaultOnly }"
            @click="defaultOnly = false"
          >
            {{ t("labs.filter_all_packs") }}
          </button>
          <button
            :class="{ active: defaultOnly }"
            @click="defaultOnly = true"
          >
            {{ t("labs.filter_default_rotation") }}
          </button>
        </div>
        <ClientOnly>
          <UInput
            v-model="packSearch"
            class="labs-search"
            icon="i-solar-minimalistic-magnifer-bold-duotone"
            :placeholder="t('labs.search_packs')"
          />
        </ClientOnly>
        <ClientOnly>
          <USelect
            v-model="packSort"
            :items="packSortOptions"
            class="labs-select"
          />
        </ClientOnly>
      </div>

      <div v-if="packsLoading" class="labs-state">
        <Icon name="solar:loading-bold-duotone" class="animate-spin" />
        <p>{{ t("labs.loading_packs") }}</p>
      </div>
      <div v-else-if="visiblePacks.length === 0" class="labs-state">
        <Icon name="solar:inbox-line-bold-duotone" />
        <h3>{{ t("labs.no_packs_title") }}</h3>
        <p>
          {{
            defaultOnly
              ? t("labs.no_packs_default_body")
              : t("labs.no_packs_body")
          }}
        </p>
      </div>
      <div v-else class="pack-tiles">
        <button
          v-for="tile in visiblePacks"
          :key="tile.pack"
          class="pack-tile"
          type="button"
          @click="openPack(tile.pack)"
        >
          <span v-if="tile.isDefault" class="pack-tile__badge"
            >{{ t("labs.in_default_rotation") }}</span
          >
          <span class="pack-tile__name">{{ tile.pack }}</span>
          <span class="pack-tile__counts">
            <span class="pack-tile__count pack-tile__count--white">
              <i /> {{ t("labs.answers_count", tile.white) }}
            </span>
            <span class="pack-tile__count pack-tile__count--black">
              <i /> {{ t("labs.prompts_count", tile.black) }}
            </span>
          </span>
        </button>
      </div>
    </template>

    <!-- ── Cards inside one pack ────────────────────────────────────── -->
    <template v-else>
      <div class="labs-feed-heading">
        <div>
          <button class="pack-back" type="button" @click="closePack">
            <Icon name="solar:alt-arrow-left-bold-duotone" /> {{ t("labs.back_to_packs") }}
          </button>
          <h2>{{ selectedPack }}</h2>
        </div>
        <p>{{ cardNoun }}</p>
      </div>

      <div class="labs-controls">
        <div class="labs-filter-group" :aria-label="t('labs.packs_title')">
          <button
            :class="{ active: type === 'white' }"
            @click="setType('white')"
          >
            {{ t("labs.filter_answers") }}
          </button>
          <button
            :class="{ active: type === 'black' }"
            @click="setType('black')"
          >
            {{ t("labs.filter_prompts") }}
          </button>
        </div>
        <ClientOnly>
          <UInput
            v-model="search"
            class="labs-search"
            icon="i-solar-minimalistic-magnifer-bold-duotone"
            :placeholder="t('labs.search_this_pack')"
          />
        </ClientOnly>
      </div>

      <div v-if="cardsLoading" class="labs-state">
        <Icon name="solar:loading-bold-duotone" class="animate-spin" />
        <p>{{ t("labs.loading_cards") }}</p>
      </div>
      <div v-else-if="cards.length === 0" class="labs-state">
        <Icon name="solar:card-search-bold-duotone" />
        <h3>{{ t("labs.no_cards_title") }}</h3>
        <p>
          {{
            search
              ? t("labs.no_cards_search")
              : t("labs.no_cards_type")
          }}
        </p>
      </div>
      <template v-else>
        <LabsCardPackGrid
          :cards="cards"
          :type="type"
          @select="openLightbox"
        />
        <LabsCardLightbox
          v-model:open="lightboxOpen"
          :card="lightboxCard"
          :type="type"
          :position="lightboxGlobalIndex + 1"
          :total="total"
          @step="stepLightbox"
        />
        <div v-if="total > perPage" class="labs-pagination">
          <p class="pack-range">
            {{
              t("labs.showing_range", {
                from: (page - 1) * perPage + 1,
                to: Math.min(page * perPage, total),
                total,
              })
            }}
          </p>
          <ClientOnly>
            <UPagination
              v-model:page="page"
              :total="total"
              :items-per-page="perPage"
            />
          </ClientOnly>
        </div>
      </template>
    </template>
  </div>
</template>

<script lang="ts" setup>
// The Labs "Card Packs" tab: a gallery of packs that drills into the cards each
// one holds. Read-only counterpart to the admin Cards Manager — it reads the
// public /api/cards/browse route, which only ever returns active cards, so the
// browser can never advertise a card a game would not deal.
import { watchDebounced } from "@vueuse/core";
import type { CardBrowseResponse } from "~/types/cardBrowser";
import {
  filterAndSortPacks,
  pageForIndex,
  stepCardIndex,
  type PackSort,
} from "~/utils/cardPacks";

const PER_PAGE = 24;

const { $activityFetch } = useNuxtApp();
const { t } = useI18n();

// Shared with the Labs hero's card-count stat — see useCardPacks.
const {
  tiles: packTiles,
  loading: packsLoading,
  load: loadPacks,
} = useCardPacks();
const packSearch = ref("");
const packSort = ref<PackSort>("cards-desc");
const defaultOnly = ref(false);

const selectedPack = ref<string | null>(null);
const type = ref<"white" | "black">("white");
const search = ref("");
const page = ref(1);
const perPage = PER_PAGE;
const cards = ref<CardBrowseResponse["cards"]>([]);
const total = ref(0);
const cardsLoading = ref(false);

const packSortOptions = computed(() => [
  { label: t("labs.sort_most_cards"), value: "cards-desc" },
  { label: t("labs.sort_fewest_cards"), value: "cards-asc" },
  { label: t("labs.sort_alpha"), value: "name" },
]);

const visiblePacks = computed(() =>
  filterAndSortPacks(packTiles.value, {
    search: packSearch.value,
    defaultOnly: defaultOnly.value,
    sort: packSort.value,
  }),
);

// Counts the packs actually on screen, so a filtered gallery does not keep
// advertising the whole library's card total.
const visibleCards = computed(() =>
  visiblePacks.value.reduce((sum, tile) => sum + tile.total, 0),
);

// The lightbox addresses cards by their position in the whole filtered result
// set, not within the loaded page — so stepping off the end of page 1 moves to
// card 25 and pulls page 2. The browser owns that position because acting on it
// means changing `page`, which is what drives the fetch.
const lightboxOpen = ref(false);
const lightboxGlobalIndex = ref(0);

const lightboxLocation = computed(() =>
  pageForIndex(lightboxGlobalIndex.value, perPage),
);

// Null while the page holding the current position is still in flight, which is
// what the lightbox renders its spinner for.
const lightboxCard = computed(() =>
  lightboxLocation.value.page === page.value
    ? (cards.value[lightboxLocation.value.offset] ?? null)
    : null,
);

function openLightbox(offset: number) {
  lightboxGlobalIndex.value = (page.value - 1) * perPage + offset;
  lightboxOpen.value = true;
}

function stepLightbox(delta: number) {
  if (total.value === 0) return;
  // Steps are deliberately *not* dropped while a fetch is in flight. Several
  // steps in one flush settle `page` before the query watcher reads it, so even
  // a 30-click burst across two page boundaries issues a single request for the
  // page it lands on — and `requestSeq` in fetchCards discards any stale reply.
  lightboxGlobalIndex.value = stepCardIndex(
    lightboxGlobalIndex.value,
    delta,
    total.value,
  );
  const next = pageForIndex(lightboxGlobalIndex.value, perPage);
  if (next.page !== page.value) page.value = next.page;
}

const cardNoun = computed(() =>
  t(
    type.value === "black" ? "labs.prompts_count" : "labs.answers_count",
    total.value,
  ),
);

// `search` is bound to the input; `searchTerm` is the debounced value the query
// actually uses. Kept as two plain refs (rather than refDebounced) so opening a
// pack can clear both synchronously and not trigger a stale trailing fetch.
const searchTerm = ref("");
watchDebounced(
  search,
  () => {
    searchTerm.value = search.value.trim();
  },
  { debounce: 300, maxWait: 700 },
);

// Declared before the fetch watcher below so that when a filter changes, both
// run in the same flush and the fetch sees page 1 — one request, not two.
// A filter change also invalidates the lightbox's position, which is an index
// into the old result set; a plain page change deliberately does not, since
// that is how the lightbox pages through.
watch([selectedPack, type, searchTerm], () => {
  page.value = 1;
  lightboxOpen.value = false;
  lightboxGlobalIndex.value = 0;
});

const queryKey = computed(
  () =>
    `${selectedPack.value}|${type.value}|${searchTerm.value}|${page.value}`,
);

// Every filter funnels through this one watcher, so a multi-field change like
// openPack() issues exactly one request instead of one per field. `requestSeq`
// then keeps a slow earlier response from overwriting a newer one.
let requestSeq = 0;

async function fetchCards() {
  if (!selectedPack.value) return;
  const seq = ++requestSeq;
  cardsLoading.value = true;
  try {
    const result = await $activityFetch<CardBrowseResponse>(
      "/api/cards/browse",
      {
        query: {
          type: type.value,
          pack: selectedPack.value,
          search: searchTerm.value || undefined,
          page: page.value,
          perPage,
        },
      },
    );
    if (seq !== requestSeq) return;
    cards.value = result.cards;
    total.value = result.total;
  } catch (error) {
    if (seq !== requestSeq) return;
    console.error("Error loading cards:", error);
    useToast().add({ title: t("labs.error_cards"), color: "error" });
  } finally {
    if (seq === requestSeq) cardsLoading.value = false;
  }
}

watch(queryKey, fetchCards);

function openPack(pack: string) {
  selectedPack.value = pack;
  type.value = "white";
  search.value = "";
  searchTerm.value = "";
  page.value = 1;
}

function closePack() {
  // Bumping the sequence discards any reply still in flight for the pack the
  // user just left.
  requestSeq++;
  selectedPack.value = null;
  cards.value = [];
  total.value = 0;
  cardsLoading.value = false;
  lightboxOpen.value = false;
}

function setType(next: "white" | "black") {
  type.value = next;
}

onMounted(loadPacks);
</script>

<style scoped>
.pack-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}
.pack-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 8.5rem;
  padding: 1.15rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(5, 6, 13, 0.55);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
}
.pack-tile:hover,
.pack-tile:focus-visible {
  border-color: rgba(169, 237, 135, 0.55);
  background: rgba(140, 220, 120, 0.09);
  transform: translateY(-2px);
}
.pack-tile__badge {
  width: max-content;
  padding: 0.2rem 0.45rem;
  border: 1px solid rgba(169, 237, 135, 0.45);
  border-radius: 999px;
  color: #a9ed87;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.52rem;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}
.pack-tile__name {
  font-family: "Archivo Black", sans-serif;
  font-size: 1.05rem;
  line-height: 1.15;
  text-transform: uppercase;
}
.pack-tile__counts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: auto;
}
.pack-tile__count {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: #8891b4;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.6rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.pack-tile__count i {
  width: 0.5rem;
  height: 0.65rem;
  border-radius: 2px;
}
.pack-tile__count--white i {
  background: #e7e1de;
}
.pack-tile__count--black i {
  background: #1c2342;
  border: 1px solid rgba(255, 255, 255, 0.45);
}
.pack-back {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0;
  border: 0;
  background: none;
  color: #a9ed87;
  cursor: pointer;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.61rem;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}
.pack-range {
  margin: 0;
  color: #8891b4;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.63rem;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
</style>
