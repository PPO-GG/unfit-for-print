<template>
  <UModal
    :open="open"
    :title="t('lobby.editor.title')"
    :fullscreen="isCompact"
    :ui="{ content: contentClass }"
    @update:open="(v: boolean) => { if (!v) $emit('close'); }"
  >
    <template #content>
      <div class="lre">
        <header class="lre-header">
          <div>
            <h2 class="lre-title">{{ t("lobby.editor.title") }}</h2>
            <p v-if="!isHost" class="lre-readonly">{{ t("lobby.editor.read_only") }}</p>
          </div>
          <button class="lb-btn lb-btn--quiet lb-btn--icon" :aria-label="t('lobby.editor.close')" @click="$emit('close')">
            <UIcon name="i-solar-close-circle-bold-duotone" />
          </button>
        </header>

        <div v-if="settings" class="lre-columns">
          <!-- ── Rules ─────────────────────────────────────────── -->
          <section class="lre-rules">
            <label class="lre-label" for="lre-name">{{ t("game.settings.lobby_name") }}</label>
            <input
              id="lre-name"
              v-model="lobbyNameLocal"
              class="lobby-input lre-name"
              :disabled="!isHost"
              :placeholder="t('lobby.editor.name_placeholder')"
              @input="isHost && writeLobbyName(lobbyNameLocal)"
            />

            <h3 class="lre-group">{{ t("lobby.editor.scoring") }}</h3>
            <div class="lre-grid-2">
              <div>
                <div class="lre-label">{{ t("lobby.editor.points_to_win") }}</div>
                <div class="lre-stepper">
                  <button class="lb-btn lb-btn--secondary lb-btn--icon lre-points-down" :aria-label="t('lobby.editor.decrease', { setting: pointsLabel })" :disabled="!isHost || settings.maxPoints <= 3" @click="update('maxPoints', settings.maxPoints - 1)">−</button>
                  <span class="lre-step-val">{{ settings.maxPoints }}</span>
                  <button class="lb-btn lb-btn--secondary lb-btn--icon lre-points-up" :aria-label="t('lobby.editor.increase', { setting: pointsLabel })" :disabled="!isHost || settings.maxPoints >= 20" @click="update('maxPoints', settings.maxPoints + 1)">+</button>
                </div>
              </div>
              <div>
                <div class="lre-label">{{ t("lobby.editor.cards_in_hand") }}</div>
                <div class="lre-stepper">
                  <button class="lb-btn lb-btn--secondary lb-btn--icon" :aria-label="t('lobby.editor.decrease', { setting: handLabel })" :disabled="!isHost || settings.cardsPerPlayer <= 5" @click="update('cardsPerPlayer', settings.cardsPerPlayer - 1)">−</button>
                  <span class="lre-step-val">{{ settings.cardsPerPlayer }}</span>
                  <button class="lb-btn lb-btn--secondary lb-btn--icon" :aria-label="t('lobby.editor.increase', { setting: handLabel })" :disabled="!isHost || settings.cardsPerPlayer >= 15" @click="update('cardsPerPlayer', settings.cardsPerPlayer + 1)">+</button>
                </div>
              </div>
            </div>
            <div class="lre-label">
              {{ t("lobby.editor.max_pick") }}
              <span class="lre-hint">{{ t("lobby.editor.max_pick_hint") }}</span>
            </div>
            <div class="lobby-segmented">
              <button
                v-for="n in [1, 2, 3]"
                :key="n"
                :class="{ on: settings.maxPick === n }"
                :disabled="!isHost"
                @click="isHost && update('maxPick', n)"
              >
                {{ t("game.settings.pick_n", { n }) }}
              </button>
            </div>

            <h3 class="lre-group">{{ t("lobby.editor.options") }}</h3>
            <button type="button" role="switch" class="lre-switch-row lre-switch-private" :aria-checked="settings.isPrivate" :disabled="!isHost" @click="isHost && update('isPrivate', !settings.isPrivate)">
              <span class="lre-switch-text"><span class="lre-switch-label">{{ t("lobby.editor.private") }}</span><span class="lre-switch-sub">{{ t("lobby.editor.private_sub") }}</span></span>
              <span class="lre-switch" :class="{ 'lre-switch--on': settings.isPrivate }" aria-hidden="true" />
            </button>
            <button type="button" role="switch" class="lre-switch-row" :aria-checked="requirePassword" :disabled="!isHost" @click="isHost && toggleRequirePassword()">
              <span class="lre-switch-text"><span class="lre-switch-label">{{ t("lobby.editor.password") }}</span><span class="lre-switch-sub">{{ t("lobby.editor.password_sub") }}</span></span>
              <span class="lre-switch" :class="{ 'lre-switch--on': requirePassword }" aria-hidden="true" />
            </button>
            <input
              v-if="requirePassword"
              v-model="passwordLocal"
              class="lobby-input lre-password"
              :disabled="!isHost"
              :placeholder="t('game.settings.lobby_password')"
              @input="isHost && writePassword(passwordLocal)"
            />
            <button type="button" role="switch" class="lre-switch-row" :aria-checked="settings.manualDraw" :disabled="!isHost" @click="isHost && update('manualDraw', !settings.manualDraw)">
              <span class="lre-switch-text"><span class="lre-switch-label">{{ t("lobby.editor.manual_draw") }}</span><span class="lre-switch-sub">{{ t("lobby.editor.manual_draw_sub") }}</span></span>
              <span class="lre-switch" :class="{ 'lre-switch--on': settings.manualDraw }" aria-hidden="true" />
            </button>
          </section>

          <!-- ── Packs ─────────────────────────────────────────── -->
          <section class="lre-packs">
            <div class="lre-packs-head">
              <h3 class="lre-group lre-group--flush">{{ t("game.settings.card_packs") }}</h3>
              <span class="lre-tally">
                {{
                  tally.all
                    ? t("lobby.editor.tally_all", { white: tally.white, black: tally.black })
                    : t("lobby.editor.tally", { packs: tally.packs, total: tiles.length, white: tally.white, black: tally.black })
                }}
              </span>
            </div>
            <div class="lre-controls">
              <div class="lre-filters" role="tablist">
                <button
                  v-for="f in FILTERS"
                  :key="f"
                  role="tab"
                  class="lre-filter"
                  :class="{ 'lre-filter--on': filter === f }"
                  :aria-selected="filter === f"
                  @click="filter = f"
                >
                  {{ t(`lobby.editor.filter_${f}`) }}<small>{{ f === "selected" && tally.all ? t("lobby.editor.all_short") : counts[f] }}</small>
                </button>
              </div>
              <input v-model="search" class="lobby-input lre-search" :aria-label="t('labs.search_packs')" :placeholder="t('labs.search_packs')" />
              <template v-if="isHost">
                <button class="lb-btn lb-btn--secondary lb-btn--sm lre-defaults" :disabled="defaultIds.length === 0" @click="applyDefaults">
                  {{ t("lobby.editor.defaults") }}
                </button>
                <button class="lb-btn lb-btn--primary lb-btn--sm lre-shuffle" :disabled="shufflePending || tiles.length === 0" :title="t('game.settings.shuffle_packs_hint')" @click="shufflePacks">
                  <UIcon name="i-solar-shuffle-bold-duotone" :class="{ 'lre-spin': shufflePending }" />
                  {{ t("game.settings.shuffle_packs") }}
                </button>
              </template>
            </div>
            <div class="lre-tiles">
              <PackPickTile
                v-for="tile in visibleTiles"
                :key="tile.id"
                :tile="tile"
                :selected="selectedSet.has(tile.id)"
                :series-prefix="seriesPrefix"
                :disabled="!isHost"
                @toggle="togglePack"
              />
              <p v-if="tiles.length > 0 && visibleTiles.length === 0" class="lre-empty">{{ t("lobby.editor.no_packs_match") }}</p>
              <div v-if="tiles.length === 0 && rosterFailed" class="lre-empty lre-roster-failed">
                <p>{{ t("game.settings.fetch_packs_error") }}</p>
                <button type="button" class="lb-btn lb-btn--secondary lb-btn--sm lre-retry" @click="loadRoster(true)">
                  {{ t("lobby.editor.retry") }}
                </button>
              </div>
              <p v-else-if="tiles.length === 0 && rosterLoading" class="lre-empty">{{ t("labs.loading_packs") }}</p>
            </div>
          </section>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script lang="ts" setup>
import type { LobbySettings } from "~/composables/useLobbyReactive";
import { useLobby } from "~/composables/useLobby";
import { useCardPacks } from "~/composables/useCardPacks";
import { useShufflePacks } from "~/composables/useShufflePacks";
import { useCompactLayout } from "~/composables/useCompactLayout";
import { filterAndSortPacks } from "~/utils/cardPacks";
import {
  normalizePackSelection,
  packRoster,
  packTally,
  type PackFilter,
} from "~/utils/lobbyPackSelection";

const FILTERS: PackFilter[] = ["all", "selected", "default"];

const props = defineProps<{
  open: boolean;
  settings: LobbySettings | null;
  isHost: boolean;
  /** Postgres lobby id — the password lives there, not in the Y.Doc. */
  lobbyId: string;
  packFilter?: PackFilter;
}>();

defineEmits<{ (e: "close"): void }>();

const { t } = useI18n();
const { notify } = useNotifications();
const { mutations, lobbyDoc } = useLobby();
const synced = lobbyDoc.synced;
const { isCompact } = useCompactLayout();
// Fullscreen on compact: Nuxt UI already pins the content to inset-0, so the
// fixed width and border only apply to the windowed desktop modal.
const contentClass = computed(() =>
  isCompact.value
    ? "lobby-tokens lre-content"
    : "lobby-tokens lre-content lre-content--windowed",
);
const { tiles, load, seriesPrefix } = useCardPacks();
const { shuffle, pending: shufflePending } = useShufflePacks();

// ── Pack selection ──────────────────────────────────────────────
const roster = computed(() => packRoster(tiles.value));

// Always ids. A pre-migration lobby's raw keys are mapped here for display and
// written back as ids by the host (see the normalise watcher below).
const activePacks = computed<string[]>(() => {
  const raw = props.settings?.cardPacks ?? [];
  if (tiles.value.length === 0) return raw;
  return normalizePackSelection(raw, roster.value).ids;
});
const selectedSet = computed(() => new Set(activePacks.value));
const defaultIds = computed(() => tiles.value.filter((tile) => tile.isDefault).map((tile) => tile.id));
const tally = computed(() => packTally(tiles.value, activePacks.value));
const counts = computed<Record<PackFilter, number>>(() => ({
  all: tiles.value.length,
  selected: activePacks.value.length,
  default: defaultIds.value.length,
}));

const pointsLabel = computed(() => t("lobby.editor.points_to_win"));
const handLabel = computed(() => t("lobby.editor.cards_in_hand"));

const filter = ref<PackFilter>(props.packFilter ?? "all");
const search = ref("");
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      filter.value = props.packFilter ?? "all";
      search.value = "";
    }
  },
);

const visibleTiles = computed(() => {
  const base =
    filter.value === "selected"
      ? tiles.value.filter((tile) => selectedSet.value.has(tile.id))
      : tiles.value;
  return filterAndSortPacks(base, {
    search: search.value,
    defaultOnly: filter.value === "default",
    sort: "cards-desc",
    seriesPrefix: seriesPrefix.value,
  });
});

function togglePack(packId: string) {
  if (!props.isHost) return;
  const current = activePacks.value;
  const next = current.includes(packId)
    ? current.filter((p) => p !== packId)
    : [...current, packId];
  mutations.updateSettings({ cardPacks: next });
}

function applyDefaults() {
  if (!props.isHost || defaultIds.value.length === 0) return;
  mutations.updateSettings({ cardPacks: defaultIds.value });
}

function shufflePacks() {
  if (!props.isHost) return;
  return shuffle(activePacks.value);
}

// ── Roster load + one-time host normalisation ───────────────────
// The editor is mounted with the room, which can be before the Y.Doc has
// synced. Normalising against `settings: null` would read an empty selection
// and write defaults over the lobby's real packs, so this waits until both the
// roster and the settings are present, and runs once.
const rosterReady = ref(false);
const rosterLoading = ref(true);
const rosterFailed = ref(false);
let normalised = false;
let cancelled = false;
onBeforeUnmount(() => { cancelled = true; });

// `load()` swallows its own errors and leaves `tiles` empty, so an empty roster
// afterwards is the failure signal. Retry goes through here too, and a success
// only flips `rosterReady`; the normalise watcher below keeps every one of its
// gates (once-only, synced, settings, host), so a retry cannot bypass them.
async function loadRoster(force = false) {
  rosterLoading.value = true;
  rosterFailed.value = false;
  await load(force ? { force: true } : undefined);
  if (cancelled) return;
  rosterLoading.value = false;
  if (tiles.value.length === 0) {
    rosterFailed.value = true;
    notify({
      title: t("game.settings.fetch_packs_error"),
      icon: "i-solar-danger-circle-bold-duotone",
      color: "error",
    });
    return;
  }
  rosterReady.value = true;
}

onMounted(() => loadRoster());

watch(
  [rosterReady, synced, () => props.settings, () => props.isHost],
  ([ready, isSynced, settings, isHost]) => {
    // `settings` is never null once the doc object exists: before the first
    // sync it parses to an empty selection, which would read as "seed defaults"
    // and race the server's real cardPacks. So wait for the doc to have synced.
    if (normalised || !ready || !isSynced || !settings || !isHost) return;
    normalised = true;
    const current = settings.cardPacks ?? [];
    const { ids, changed } = normalizePackSelection(current, roster.value);
    if (current.length > 0 && !changed) return;
    const next =
      ids.length > 0
        ? ids
        : defaultIds.value.length > 0
          ? defaultIds.value
          : tiles.value.map((tile) => tile.id);
    mutations.updateSettings({ cardPacks: next });
  },
  { immediate: true },
);

// ── Rules (moved from LobbySettingsDrawer unchanged) ────────────
function useDebouncedWrite<T>(writeFn: (v: T) => void, delayMs = 300) {
  let handle: ReturnType<typeof setTimeout> | null = null;
  return (value: T) => {
    if (handle) clearTimeout(handle);
    handle = setTimeout(() => {
      writeFn(value);
      handle = null;
    }, delayMs);
  };
}

const writeLobbyName = useDebouncedWrite(
  (v: string) => mutations.updateSettings({ lobbyName: v }),
  300,
);

/**
 * Sends the password to the server, hashed on arrival, and mirrors only a
 * boolean into the doc. It used to write the password itself into Y.Doc
 * settings, which broadcast it in plaintext to everyone in the lobby.
 */
async function persistPassword(v: string) {
  if (!props.isHost) return;
  try {
    await $fetch("/api/lobby/password", {
      method: "POST",
      body: { lobbyId: props.lobbyId, password: v },
    });
    mutations.updateSettings({ hasPassword: v.length > 0 });
  } catch {
    notify({ title: t("game.settings.update_failed"), color: "error" });
  }
}

const writePassword = useDebouncedWrite((v: string) => {
  void persistPassword(v);
}, 300);

const lobbyNameLocal = ref(props.settings?.lobbyName ?? "");
// Write-only: the password is never sent back to clients, so this starts blank
// and an empty box means "unchanged", not "no password".
const passwordLocal = ref("");

watch(
  () => props.settings?.lobbyName,
  (v) => {
    if (v !== undefined && v !== lobbyNameLocal.value) lobbyNameLocal.value = v;
  },
);

// The persisted state is just `hasPassword`; this local intent lets toggling
// ON reveal the input before anything is typed.
const requirePasswordLocal = ref(false);
watch(
  () => props.settings?.hasPassword,
  (has) => {
    if (has) requirePasswordLocal.value = true;
  },
  { immediate: true },
);
const requirePassword = computed(
  () => requirePasswordLocal.value || !!props.settings?.hasPassword,
);

function update(key: string, value: unknown) {
  if (!props.isHost) return;
  mutations.updateSettings({ [key]: value });
}

function toggleRequirePassword() {
  if (!props.isHost) return;
  const next = !requirePassword.value;
  requirePasswordLocal.value = next;
  if (!next) {
    // Unchecking clears the stored hash, not just the flag.
    void persistPassword("");
    passwordLocal.value = "";
  }
}
</script>

<style scoped>
.lre {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  max-height: min(88dvh, 760px);
  padding: 20px 22px;
  color: var(--lb-ink);
  background: #11152a;
  font-family: "Barlow Condensed", system-ui, sans-serif;
}
.lre-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.lre-title { margin: 0; font-family: 'Archivo Black', sans-serif; font-size: 20px; letter-spacing: 0.03em; text-transform: uppercase; }
.lre-readonly { margin: 4px 0 0; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--lb-ink-muted); }

.lre-columns {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
  gap: 24px;
}
.lre-rules { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; padding-right: 4px; }
.lre-group { margin: 8px 0 0; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--lb-ink-muted); }
.lre-group--flush { margin: 0; }
.lre-label { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: var(--lb-ink-dim); }
.lre-hint { font-size: 10px; color: var(--lb-ink-muted); }
.lre-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.lre-stepper { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.lre-step-val { min-width: 28px; text-align: center; font-family: 'Archivo Black', sans-serif; font-size: 20px; }

.lre-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 10px 0;
  border: none;
  border-bottom: 1px solid var(--lb-line);
  background: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.lre-switch-row:disabled { cursor: default; opacity: 0.6; }
.lre-switch-row:focus-visible { outline: 2px solid var(--lb-accent); outline-offset: 2px; }
.lre-switch-text { display: flex; flex-direction: column; gap: 2px; }
.lre-switch-label { font-size: 13px; }
.lre-switch-sub { font-size: 10px; color: var(--lb-ink-muted); }
.lre-switch { position: relative; flex: none; width: 34px; height: 18px; border-radius: 999px; background: var(--lb-line-strong); transition: background 160ms ease; }
.lre-switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 12px; height: 12px; border-radius: 50%; background: var(--lb-ink-dim); transition: transform 160ms ease, background 160ms ease; }
.lre-switch--on { background: var(--lb-accent-lime); }
.lre-switch--on::after { transform: translateX(16px); background: #0d0f1a; }

.lre-packs { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.lre-packs-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.lre-tally { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--lb-ink-dim); }
.lre-controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.lre-filters { display: flex; border: 1px solid var(--lb-line-strong); border-radius: 8px; overflow: hidden; }
.lre-filter { padding: 6px 10px; border: none; background: none; color: var(--lb-ink-dim); font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }
.lre-filter small { margin-left: 5px; opacity: 0.7; }
.lre-filter--on { background: oklch(80% 0.20 140 / 0.18); color: oklch(85% 0.20 140); }
.lre-search { flex: 1; min-width: 120px; }
.lre-tiles {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-content: start;
  gap: 8px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: var(--lb-line-strong) transparent;
}
.lre-empty { grid-column: 1 / -1; text-align: center; padding: 20px 0; color: var(--lb-ink-muted); font-family: 'JetBrains Mono', monospace; font-size: 11px; }
.lre-roster-failed { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.lre-roster-failed p { margin: 0; }
.lre-spin { animation: lre-spin 0.8s linear infinite; }
@keyframes lre-spin { to { transform: rotate(360deg); } }

@media (max-width: 767px), (max-height: 499px) {
  .lre { max-height: none; padding: 16px; }
  .lre-columns { display: flex; flex-direction: column; overflow-y: auto; }
  .lre-rules { overflow: visible; }
  .lre-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); overflow: visible; }
}
@media (prefers-reduced-motion: reduce) {
  .lre-spin { animation: none; opacity: 0.6; }
  .lre-switch, .lre-switch::after { transition: none; }
}
</style>

<style>
/* UModal teleports its content to body, outside .lobby-room, so the width
   and surface have to be set on the content element itself. */
.lre-content { background: #11152a; }
.lre-content--windowed { width: min(920px, calc(100vw - 32px)); max-width: none; border: 1px solid var(--lb-line-strong); }
</style>
