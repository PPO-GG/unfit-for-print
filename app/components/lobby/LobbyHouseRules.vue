<template>
  <aside class="lobby-house-rules lobby-panel">
    <header class="lhr-header">
      <h2 class="lhr-title">{{ t("lobby.rules.title") }}</h2>
      <button class="lb-btn lb-btn--secondary lb-btn--sm lhr-edit" @click="$emit('edit', 'all')">
        <UIcon :name="isHost ? 'i-solar-settings-bold-duotone' : 'i-solar-eye-bold-duotone'" />
        {{ isHost ? t("lobby.rules.edit") : t("lobby.rules.details") }}
      </button>
    </header>

    <template v-if="settings">
      <div class="lhr-stats">
        <div class="lhr-stat"><span class="lhr-stat-val">{{ settings.maxPoints }}</span><span class="lhr-stat-lbl">{{ t("lobby.rules.points") }}</span></div>
        <div class="lhr-stat"><span class="lhr-stat-val">{{ settings.cardsPerPlayer }}</span><span class="lhr-stat-lbl">{{ t("lobby.rules.hand") }}</span></div>
        <div class="lhr-stat"><span class="lhr-stat-val">≤ {{ settings.maxPick }}</span><span class="lhr-stat-lbl">{{ t("lobby.rules.pick") }}</span></div>
        <div class="lhr-stat"><span class="lhr-stat-val">{{ settings.manualDraw ? t("lobby.rules.draw_manual") : t("lobby.rules.draw_auto") }}</span><span class="lhr-stat-lbl">{{ t("lobby.rules.draw") }}</span></div>
      </div>

      <div v-if="settings.hasPassword || settings.isPrivate" class="lhr-flags">
        <span v-if="settings.hasPassword" class="lobby-chip lhr-flag--password"><UIcon name="i-solar-lock-keyhole-bold-duotone" />{{ t("lobby.rules.password") }}</span>
        <span v-if="settings.isPrivate" class="lobby-chip lhr-flag--private"><UIcon name="i-solar-eye-closed-bold-duotone" />{{ t("lobby.rules.private") }}</span>
      </div>

      <div class="lobby-ticket-sep lhr-sep" />

      <div class="lhr-packs-head">
        <span class="lhr-section">{{ t("game.settings.card_packs") }}</span>
        <span class="lhr-tally">{{ t("lobby.rules.pack_tally", { packs: tally.packs, white: tally.white, black: tally.black }) }}</span>
      </div>
      <ul class="lhr-pack-list">
        <li v-if="tally.all" class="lhr-all">{{ t("lobby.rules.all_packs") }}</li>
        <li v-for="name in shownNames" :key="name" class="lhr-pack">{{ name }}</li>
      </ul>
      <button v-if="extraNames > 0" class="lhr-more" @click="$emit('edit', 'selected')">
        {{ t("lobby.rules.more", { count: extraNames }) }}
      </button>

      <div class="lhr-spacer" />

      <template v-if="isHost">
        <button class="lb-btn lb-btn--primary lhr-shuffle" :disabled="shuffling" @click="$emit('shuffle')">
          <UIcon name="i-solar-shuffle-bold-duotone" :class="{ 'lhr-spin': shuffling }" />
          {{ t("game.settings.shuffle_packs") }}
        </button>
        <p class="lhr-hint">{{ t("game.settings.shuffle_packs_hint") }}</p>
      </template>
    </template>
    <p v-else class="lhr-loading">{{ t("lobby.rules.loading") }}</p>
  </aside>
</template>

<script lang="ts" setup>
import type { LobbySettings } from "~/composables/useLobbyReactive";
import { useCardPacks } from "~/composables/useCardPacks";
import { packLabel } from "~/utils/packName";
import { packLabelsFor, packTally, type PackFilter } from "~/utils/lobbyPackSelection";

const MAX_NAMES = 8;

const props = defineProps<{
  settings: LobbySettings | null;
  isHost: boolean;
  shuffling?: boolean;
}>();

defineEmits<{
  (e: "edit", filter: PackFilter): void;
  (e: "shuffle"): void;
}>();

const { t } = useI18n();
const { tiles, load, seriesPrefix } = useCardPacks();
onMounted(() => load());

const selection = computed(() => props.settings?.cardPacks ?? []);
const tally = computed(() => packTally(tiles.value, selection.value));

// Short names (series stripped), so "Cards Against Humanity:" doesn't eat
// every row. Legacy name entries pass through as-is via packLabelsFor.
const namesById = computed(() =>
  Object.fromEntries(
    tiles.value.map((tile) => [tile.id, packLabel(tile.pack, tile, seriesPrefix.value).name]),
  ),
);
const names = computed(() => packLabelsFor(selection.value, namesById.value));
const shownNames = computed(() => names.value.slice(0, MAX_NAMES));
const extraNames = computed(() => Math.max(0, names.value.length - MAX_NAMES));
</script>

<style scoped>
.lobby-house-rules {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 16px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--lb-line-strong) transparent;
}
.lhr-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.lhr-title { margin: 0; font-family: 'Archivo Black', sans-serif; font-size: 16px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--lb-ink); }
.lhr-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.lhr-stat { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 6px; border-radius: 8px; background: rgba(255, 255, 255, 0.04); }
.lhr-stat-val { font-family: 'Archivo Black', sans-serif; font-size: 20px; line-height: 1; color: var(--lb-ink); }
.lhr-stat-lbl { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--lb-ink-muted); text-align: center; }
.lhr-flags { display: flex; flex-wrap: wrap; gap: 6px; }
.lhr-sep { margin: 2px 0; }
.lhr-packs-head { display: flex; flex-direction: column; gap: 3px; }
.lhr-section { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--lb-ink-muted); }
.lhr-tally { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--lb-ink-dim); }
.lhr-pack-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.lhr-pack, .lhr-all {
  padding: 5px 8px;
  border-left: 3px solid var(--lb-accent-lime);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.03);
  font-size: 12px;
  color: var(--lb-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lhr-more { align-self: flex-start; padding: 0; border: none; background: none; color: var(--lb-accent); font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
.lhr-more:hover { text-decoration: underline; }
.lhr-spacer { flex: 1; }
.lhr-shuffle { width: 100%; padding: 12px; font-size: 13px; }
.lhr-hint { margin: 0; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--lb-ink-muted); }
.lhr-loading { text-align: center; color: var(--lb-ink-muted); font-family: 'JetBrains Mono', monospace; font-size: 11px; }
.lhr-spin { animation: lhr-spin 0.8s linear infinite; }
@keyframes lhr-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .lhr-spin { animation: none; opacity: 0.6; } }
</style>
