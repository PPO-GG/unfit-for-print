<template>
  <Transition name="lobby-drawer">
    <aside v-if="open" class="lobby-settings-panel lobby-panel">
      <div class="lsd-header">
        <span class="lobby-chip">
          <span class="live-dot" />
          Game Settings
        </span>
        <button class="neon-btn neon-btn--ghost lsd-close" @click="$emit('close')">✕</button>
      </div>

      <div class="lsd-body">
        <template v-if="settings">
          <!-- Points to Win -->
          <div class="lsd-field">
            <div class="lsd-field-label">Points to Win</div>
            <div class="lsd-stepper">
              <button class="neon-btn neon-btn--ghost lsd-step-btn" :disabled="!isHost || settings.maxPoints <= 1" @click="update('maxPoints', settings.maxPoints - 1)">−</button>
              <span class="lsd-step-val">{{ settings.maxPoints }}</span>
              <button class="neon-btn neon-btn--ghost lsd-step-btn" :disabled="!isHost || settings.maxPoints >= 20" @click="update('maxPoints', settings.maxPoints + 1)">+</button>
            </div>
          </div>

          <!-- Cards Per Player -->
          <div class="lsd-field">
            <div class="lsd-field-label">Cards Per Player</div>
            <div class="lsd-stepper">
              <button class="neon-btn neon-btn--ghost lsd-step-btn" :disabled="!isHost || settings.cardsPerPlayer <= 3" @click="update('cardsPerPlayer', settings.cardsPerPlayer - 1)">−</button>
              <span class="lsd-step-val">{{ settings.cardsPerPlayer }}</span>
              <button class="neon-btn neon-btn--ghost lsd-step-btn" :disabled="!isHost || settings.cardsPerPlayer >= 15" @click="update('cardsPerPlayer', settings.cardsPerPlayer + 1)">+</button>
            </div>
          </div>

          <!-- Private Lobby -->
          <div class="lsd-field lsd-field--row">
            <div>
              <div class="lsd-field-label">Private Lobby</div>
              <div class="lsd-field-hint">Hidden from public lobby list</div>
            </div>
            <button
              class="neon-btn"
              :class="settings.isPrivate ? 'neon-btn--primary' : 'neon-btn--ghost'"
              :disabled="!isHost"
              @click="isHost && update('isPrivate', !settings.isPrivate)"
            >
              {{ settings.isPrivate ? "ON" : "OFF" }}
            </button>
          </div>

          <!-- Card Packs -->
          <div class="lsd-field">
            <div class="lsd-field-label">
              Card Packs
              <span class="lsd-field-hint" style="margin-left:6px;">{{ activePacks.length }} active</span>
            </div>
            <div v-if="loadingPacks" class="lsd-packs-loading">Loading packs…</div>
            <div v-else class="lsd-packs-list">
              <button
                v-for="pack in availablePacks"
                :key="pack"
                class="lsd-pack-row"
                :class="{ 'lsd-pack-row--active': activePacks.includes(pack) }"
                :disabled="!isHost"
                @click="isHost && togglePack(pack)"
              >
                <span class="lsd-pack-dot" :class="{ 'lsd-pack-dot--active': activePacks.includes(pack) }" />
                <span class="lsd-pack-name">{{ pack }}</span>
                <span v-if="activePacks.includes(pack)" class="lsd-pack-check">✓</span>
              </button>
              <div v-if="availablePacks.length === 0" class="lsd-packs-empty">No packs found</div>
            </div>
          </div>
        </template>
        <div v-else class="lsd-loading">Connecting to lobby…</div>
      </div>
    </aside>
  </Transition>
</template>

<script lang="ts" setup>
import { useLobby } from "~/composables/useLobby";
import type { LobbySettings } from "~/composables/useLobbyReactive";
import { getAppwrite } from "~/utils/appwrite";
import { Query } from "appwrite";

const props = defineProps<{
  open: boolean;
  settings: LobbySettings | null;
  isHost: boolean;
}>();

defineEmits<{ (e: "close"): void }>();

const config = useRuntimeConfig();
const { notify } = useNotifications();
const { t } = useI18n();
const { mutations } = useLobby();

const loadingPacks = ref(false);
const availablePacks = ref<string[]>([]);

const activePacks = computed<string[]>(() => props.settings?.cardPacks ?? []);

function update(key: string, value: unknown) {
  mutations.updateSettings({ [key]: value });
}

function togglePack(pack: string) {
  const current = activePacks.value;
  const next = current.includes(pack)
    ? current.filter((p) => p !== pack)
    : [...current, pack];
  mutations.updateSettings({ cardPacks: next });
}

const DB_ID = config.public.appwriteDatabaseId;
const CARD_COLLECTIONS = {
  black: config.public.appwriteBlackCardCollectionId as string,
  white: config.public.appwriteWhiteCardCollectionId as string,
};

onMounted(async () => {
  const { databases, tables } = getAppwrite();
  if (!databases) return;
  loadingPacks.value = true;
  try {
    const blackTotal = (await tables.listRows({
      databaseId: DB_ID,
      tableId: CARD_COLLECTIONS.black,
      queries: [Query.limit(1), Query.equal("active", true)],
    })).total;
    const chunkSize = 1000;
    const blackPacks = new Set<string>();

    for (let offset = 0; offset < blackTotal; offset += chunkSize) {
      const chunk = await tables.listRows({
        databaseId: DB_ID,
        tableId: CARD_COLLECTIONS.black,
        queries: [Query.limit(chunkSize), Query.offset(offset), Query.equal("active", true)],
      });
      chunk.rows.forEach((c: { pack?: string }) => { if (c.pack) blackPacks.add(c.pack); });
    }

    const whiteTotal = (await tables.listRows({
      databaseId: DB_ID,
      tableId: CARD_COLLECTIONS.white,
      queries: [Query.limit(1), Query.equal("active", true)],
    })).total;
    const whitePacks = new Set<string>();

    for (let offset = 0; offset < whiteTotal; offset += chunkSize) {
      const chunk = await tables.listRows({
        databaseId: DB_ID,
        tableId: CARD_COLLECTIONS.white,
        queries: [Query.limit(chunkSize), Query.offset(offset), Query.equal("active", true)],
      });
      chunk.rows.forEach((c: { pack?: string }) => { if (c.pack) whitePacks.add(c.pack); });
    }

    availablePacks.value = [...new Set([...blackPacks, ...whitePacks])].sort();
  } catch {
    notify({
      title: t("game.settings.fetch_packs_error"),
      icon: "i-solar-danger-circle-bold-duotone",
      color: "error",
    });
  } finally {
    loadingPacks.value = false;
  }
});
</script>

<style scoped>
.lobby-settings-panel {
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  width: 340px;
  z-index: 55;
  display: flex;
  flex-direction: column;
  border-radius: 0;
  border-right: none;
  border-top: none;
  border-bottom: none;
  overflow: hidden;
}

.lsd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--lb-line);
  flex-shrink: 0;
}

.lsd-close { padding: 4px 8px; font-size: 12px; }

.lsd-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  scrollbar-width: thin;
  scrollbar-color: var(--lb-line-strong) transparent;
}

.lsd-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lsd-field--row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.lsd-field-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--lb-ink-dim);
  display: flex;
  align-items: center;
}

.lsd-field-hint {
  font-size: 9px;
  color: var(--lb-ink-muted);
  letter-spacing: 0.04em;
}

.lsd-stepper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lsd-step-btn { padding: 4px 10px; font-size: 16px; }

.lsd-step-val {
  font-family: 'Archivo Black', sans-serif;
  font-size: 24px;
  color: var(--lb-ink);
  min-width: 32px;
  text-align: center;
}

.lsd-packs-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lsd-pack-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--lb-line);
  background: transparent;
  cursor: pointer;
  color: var(--lb-ink-dim);
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: left;
  transition: background 120ms, border-color 120ms;
}
.lsd-pack-row:hover:not(:disabled)   { background: rgba(255,255,255,0.04); }
.lsd-pack-row--active { border-color: var(--lb-accent); color: var(--lb-ink); }
.lsd-pack-row:disabled { opacity: 0.5; cursor: default; }

.lsd-pack-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--lb-line-strong);
  flex-shrink: 0;
}
.lsd-pack-dot--active { background: var(--lb-accent); }

.lsd-pack-name { flex: 1; }

.lsd-pack-check { color: var(--lb-accent); font-size: 12px; }

.lsd-packs-loading,
.lsd-packs-empty,
.lsd-loading {
  font-size: 11px;
  color: var(--lb-ink-muted);
  font-family: 'JetBrains Mono', monospace;
  text-align: center;
  padding: 12px 0;
}
</style>
