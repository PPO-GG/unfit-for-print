<template>
  <Transition name="lobby-drawer">
    <aside v-if="open" class="lobby-settings-panel lobby-panel">
      <div class="lsd-header">
        <div class="lsd-header-left">
          <button class="neon-btn neon-btn--ghost lsd-close" aria-label="Close settings" @click="$emit('close')">✕</button>
          <div class="lsd-header-title">GAME SETTINGS</div>
        </div>
        <span class="lobby-chip">Host only</span>
      </div>

      <div class="lsd-body">
        <template v-if="settings">
          <!-- Lobby Name -->
          <div class="lsd-field">
            <div class="lsd-field-label">Lobby Name</div>
            <input
              v-model="lobbyNameLocal"
              class="lobby-input"
              :disabled="!isHost"
              placeholder="Name this lobby"
              @input="isHost && writeLobbyName(lobbyNameLocal)"
            />
          </div>

          <!-- Points + Cards Per Player -->
          <div class="lsd-grid-2">
            <div class="lsd-field">
              <div class="lsd-field-label">Points to Win</div>
              <div class="lsd-stepper">
                <button class="neon-btn neon-btn--ghost lsd-step-btn" :disabled="!isHost || settings.maxPoints <= 1" @click="update('maxPoints', settings.maxPoints - 1)">−</button>
                <span class="lsd-step-val">{{ settings.maxPoints }}</span>
                <button class="neon-btn neon-btn--ghost lsd-step-btn" :disabled="!isHost || settings.maxPoints >= 20" @click="update('maxPoints', settings.maxPoints + 1)">+</button>
              </div>
            </div>

            <div class="lsd-field">
              <div class="lsd-field-label">Cards Per Player</div>
              <div class="lsd-stepper">
                <button class="neon-btn neon-btn--ghost lsd-step-btn" :disabled="!isHost || settings.cardsPerPlayer <= 3" @click="update('cardsPerPlayer', settings.cardsPerPlayer - 1)">−</button>
                <span class="lsd-step-val">{{ settings.cardsPerPlayer }}</span>
                <button class="neon-btn neon-btn--ghost lsd-step-btn" :disabled="!isHost || settings.cardsPerPlayer >= 15" @click="update('cardsPerPlayer', settings.cardsPerPlayer + 1)">+</button>
              </div>
            </div>
          </div>

          <!-- Max Pick -->
          <div class="lsd-field">
            <div class="lsd-field-label">
              Max Pick<span class="lsd-field-hint">Prompts with pick ≤ this allowed</span>
            </div>
            <div class="lobby-segmented">
              <button
                v-for="n in [1, 2, 3]"
                :key="n"
                :class="{ on: settings.maxPick === n }"
                :disabled="!isHost"
                @click="isHost && update('maxPick', n)"
              >PICK {{ n }}</button>
            </div>
          </div>

          <!-- Private / Password / Manual draw -->
          <div class="lsd-check-group">
            <button
              class="lsd-check-row"
              :disabled="!isHost"
              @click="isHost && update('isPrivate', !settings.isPrivate)"
            >
              <span class="lobby-check" :class="{ 'lobby-check--on': settings.isPrivate }">
                <span v-if="settings.isPrivate">✓</span>
              </span>
              <div>
                <div class="lsd-check-label">Private Lobby</div>
                <div class="lsd-check-sub">Hidden from public lobby list</div>
              </div>
            </button>

            <button
              class="lsd-check-row"
              :disabled="!isHost"
              @click="isHost && toggleRequirePassword()"
            >
              <span class="lobby-check" :class="{ 'lobby-check--on': requirePassword }">
                <span v-if="requirePassword">✓</span>
              </span>
              <div>
                <div class="lsd-check-label">Require password to join</div>
                <div class="lsd-check-sub">Players must enter a password before joining</div>
              </div>
            </button>

            <input
              v-if="requirePassword"
              v-model="passwordLocal"
              class="lobby-input lsd-password-input"
              :disabled="!isHost"
              placeholder="Lobby password"
              @input="isHost && writePassword(passwordLocal)"
            />

            <button
              class="lsd-check-row"
              :disabled="!isHost"
              @click="isHost && update('manualDraw', !settings.manualDraw)"
            >
              <span class="lobby-check" :class="{ 'lobby-check--on': settings.manualDraw }">
                <span v-if="settings.manualDraw">✓</span>
              </span>
              <div>
                <div class="lsd-check-label">Manual card draw</div>
                <div class="lsd-check-sub">Players click the deck to draw cards each round</div>
              </div>
            </button>
          </div>

          <!-- Card Packs -->
          <div class="lsd-field">
            <div class="lsd-field-label">
              Card Packs
              <span class="lsd-field-hint">{{ activePacks.length }} active</span>
            </div>
            <div v-if="loadingPacks" class="lsd-packs-loading">Loading packs…</div>
            <div v-else class="lsd-packs-chips">
              <button
                v-for="pack in availablePacks"
                :key="pack"
                class="lobby-pack-chip"
                :class="{ 'lobby-pack-chip--on': activePacks.includes(pack) }"
                :disabled="!isHost"
                @click="isHost && togglePack(pack)"
              >{{ pack }}</button>
              <div v-if="availablePacks.length === 0" class="lsd-packs-empty">No packs found</div>
            </div>
          </div>

          <!-- Footer -->
          <div class="lsd-footer">
            <button class="neon-btn" @click="$emit('close')">CANCEL</button>
            <button class="neon-btn neon-btn--primary" @click="$emit('close')">✓ SAVE</button>
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

// Inline debounce helper for text inputs — avoids flooding the Y.Doc with keystroke mutations.
function useDebouncedWrite<T>(writeFn: (v: T) => void, delayMs = 300) {
  let handle: ReturnType<typeof setTimeout> | null = null;
  return (value: T) => {
    if (handle) clearTimeout(handle);
    handle = setTimeout(() => { writeFn(value); handle = null; }, delayMs);
  };
}

const writeLobbyName = useDebouncedWrite((v: string) => mutations.updateSettings({ lobbyName: v }), 300);
const writePassword = useDebouncedWrite((v: string) => mutations.updateSettings({ password: v }), 300);

// Locally bound values for text inputs, synced from props when settings update.
const lobbyNameLocal = ref(props.settings?.lobbyName ?? "");
const passwordLocal = ref(props.settings?.password ?? "");

watch(() => props.settings?.lobbyName, (v) => {
  if (v !== undefined && v !== lobbyNameLocal.value) lobbyNameLocal.value = v;
});
watch(() => props.settings?.password, (v) => {
  if (v !== undefined && v !== passwordLocal.value) passwordLocal.value = v;
});

// Track the "require password" intent locally.
// The persisted state is just `password?: string` — truthy means required.
// We need a local ref so that toggling ON reveals the input even before the user types.
const requirePasswordLocal = ref(false);

// Initialize from current settings when they arrive / change
watch(
  () => props.settings?.password,
  (pw) => {
    if (pw && pw.length > 0) requirePasswordLocal.value = true;
  },
  { immediate: true },
);

// Computed for the UI — true if either the local toggle is on, or a non-empty password exists.
const requirePassword = computed(
  () =>
    requirePasswordLocal.value ||
    !!(props.settings?.password && props.settings.password.length > 0),
);

function update(key: string, value: unknown) {
  mutations.updateSettings({ [key]: value });
}

function toggleRequirePassword() {
  if (!props.isHost) return;
  const next = !requirePassword.value;
  requirePasswordLocal.value = next;
  if (!next) {
    // When unchecked, clear the persisted password
    mutations.updateSettings({ password: "" });
    passwordLocal.value = "";
  }
  // When checked, don't write anything to the doc until user types in the input
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

let cancelled = false;
onBeforeUnmount(() => { cancelled = true; });

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
    if (cancelled) return;
    const chunkSize = 1000;
    const blackPacks = new Set<string>();

    for (let offset = 0; offset < blackTotal; offset += chunkSize) {
      const chunk = await tables.listRows({
        databaseId: DB_ID,
        tableId: CARD_COLLECTIONS.black,
        queries: [Query.limit(chunkSize), Query.offset(offset), Query.equal("active", true)],
      });
      if (cancelled) return;
      chunk.rows.forEach((c: { pack?: string }) => { if (c.pack) blackPacks.add(c.pack); });
    }

    const whiteTotal = (await tables.listRows({
      databaseId: DB_ID,
      tableId: CARD_COLLECTIONS.white,
      queries: [Query.limit(1), Query.equal("active", true)],
    })).total;
    if (cancelled) return;
    const whitePacks = new Set<string>();

    for (let offset = 0; offset < whiteTotal; offset += chunkSize) {
      const chunk = await tables.listRows({
        databaseId: DB_ID,
        tableId: CARD_COLLECTIONS.white,
        queries: [Query.limit(chunkSize), Query.offset(offset), Query.equal("active", true)],
      });
      if (cancelled) return;
      chunk.rows.forEach((c: { pack?: string }) => { if (c.pack) whitePacks.add(c.pack); });
    }

    if (cancelled) return;
    availablePacks.value = [...new Set([...blackPacks, ...whitePacks])].sort();
  } catch {
    if (cancelled) return;
    notify({
      title: t("game.settings.fetch_packs_error"),
      icon: "i-solar-danger-circle-bold-duotone",
      color: "error",
    });
  } finally {
    if (!cancelled) loadingPacks.value = false;
  }
});
</script>

<style scoped>
.lobby-settings-panel {
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  width: 420px;
  max-width: 100%;
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
  padding: 16px 20px;
  border-bottom: 1px solid var(--lb-line);
  flex-shrink: 0;
  backdrop-filter: blur(12px);
  background: rgba(10, 13, 28, 0.85);
  position: sticky;
  top: 0;
  z-index: 5;
}

.lsd-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lsd-close {
  padding: 4px 10px;
  font-size: 12px;
  line-height: 1;
}

.lsd-header-title {
  font-family: 'Archivo Black', sans-serif;
  font-size: 16px;
  letter-spacing: 0.04em;
  color: var(--lb-ink);
}

.lsd-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  scrollbar-width: thin;
  scrollbar-color: var(--lb-line-strong) transparent;
}

.lsd-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lsd-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.lsd-field-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--lb-ink-dim);
  display: flex;
  align-items: center;
  gap: 8px;
}

.lsd-field-hint {
  font-size: 9px;
  color: var(--lb-ink-muted);
  letter-spacing: 0.04em;
  text-transform: none;
  font-family: 'JetBrains Mono', monospace;
  margin-left: auto;
}

.lsd-stepper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lsd-step-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  font-size: 16px;
  flex-shrink: 0;
}

.lsd-step-val {
  flex: 1;
  height: 36px;
  border: 1px solid var(--lb-line-strong);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Archivo Black', sans-serif;
  font-size: 18px;
  color: var(--lb-ink);
}

.lsd-check-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lsd-check-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--lb-line);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 120ms;
  width: 100%;
}
.lsd-check-row:hover:not(:disabled) { background: rgba(255, 255, 255, 0.04); }
.lsd-check-row:disabled { opacity: 0.6; cursor: default; }

.lsd-check-label {
  font-family: 'Archivo Black', sans-serif;
  font-size: 13px;
  color: var(--lb-ink);
  line-height: 1.2;
}

.lsd-check-sub {
  margin-top: 3px;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 12px;
  color: var(--lb-ink-dim);
  line-height: 1.3;
}

.lsd-password-input {
  margin-top: -2px;
}

.lsd-packs-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.lsd-packs-loading,
.lsd-packs-empty,
.lsd-loading {
  font-size: 11px;
  color: var(--lb-ink-muted);
  font-family: 'JetBrains Mono', monospace;
  text-align: center;
  padding: 12px 0;
}

.lsd-footer {
  margin-top: 6px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
</style>
