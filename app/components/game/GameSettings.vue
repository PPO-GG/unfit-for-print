<template>
  <div class="settings-panel">
    <!-- ─── Header (always visible, toggles body) ─── -->
    <button class="settings-header" @click="expanded = !expanded">
      <div class="settings-header-left">
        <Icon
          name="solar:settings-minimalistic-bold-duotone"
          class="settings-header-icon"
        />
        <span class="settings-header-title">{{ t("game.settings") }}</span>
        <span v-if="!isEditable" class="settings-readonly-badge"
          >VIEW ONLY</span
        >
      </div>
      <Icon
        name="solar:alt-arrow-down-bold"
        class="settings-chevron"
        :class="{ 'settings-chevron--open': expanded }"
      />
    </button>

    <!-- ─── Collapsible body ─── -->
    <Transition name="settings-body">
      <div v-if="expanded" class="settings-body">
        <!-- ── Edit mode ── -->
        <UForm
          v-if="isEditable"
          :state="localSettings"
          class="settings-form"
          @submit.prevent="saveSettings"
        >
          <!-- Lobby name -->
          <div class="field-group">
            <label class="field-label">{{
              t("game.settings.lobby_name")
            }}</label>
            <UInput
              v-model="localSettings.lobbyName"
              :placeholder="t('game.settings.lobby_name')"
              class="settings-input"
            />
          </div>

          <!-- Points + Cards per player -->
          <div class="field-row">
            <div class="field-group">
              <label class="field-label">{{
                t("game.settings.points_to_win")
              }}</label>
              <UInput
                v-model.number="localSettings.maxPoints"
                type="number"
                min="1"
                max="50"
                class="settings-input"
              />
            </div>
            <div class="field-group">
              <label class="field-label">{{
                t("game.settings.cards_per_player")
              }}</label>
              <UInput
                v-model.number="localSettings.numPlayerCards"
                type="number"
                min="5"
                max="20"
                class="settings-input"
              />
            </div>
          </div>

          <!-- Private toggle -->
          <div class="field-group field-inline">
            <UCheckbox
              v-model="localSettings.isPrivate"
              :label="t('game.settings.is_private')"
            />
          </div>

          <!-- Password (conditional) -->
          <div v-if="localSettings.isPrivate" class="field-group">
            <label class="field-label">{{
              t("game.settings.lobby_password")
            }}</label>
            <UInput
              v-model="localSettings.password"
              :placeholder="t('game.settings.lobby_password')"
              type="password"
              class="settings-input"
            />
          </div>

          <!-- Card packs -->
          <div class="field-group">
            <label class="field-label">{{
              t("game.settings.card_packs")
            }}</label>
            <USelectMenu
              v-model="localSettings.cardPacks"
              :items="availablePacks"
              :loading="loadingPacks"
              multiple
              class="w-full"
            />
            <div v-if="localSettings.cardPacks?.length" class="pack-tags">
              <span
                v-for="pack in localSettings.cardPacks"
                :key="pack"
                class="pack-tag"
              >
                {{ pack }}
              </span>
            </div>
          </div>

          <!-- Save -->
          <UButton
            type="submit"
            color="primary"
            class="save-btn"
            icon="i-solar-floppy-disk-bold-duotone"
            block
          >
            {{ t("game.settings.save_settings") }}
          </UButton>
        </UForm>

        <!-- ── Read-only mode ── -->
        <div v-else class="settings-readonly">
          <div
            v-for="(label, key) in readOnlyMap"
            :key="key"
            class="readonly-row"
          >
            <span class="readonly-key">{{ label }}</span>
            <span class="readonly-val">{{ formatValue(key) }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch } from "vue";
import type { GameSettings } from "~/types/gamesettings";
import { useGameSettings } from "~/composables/useGameSettings";
import { useNotifications } from "~/composables/useNotifications";
import { getAppwrite } from "~/utils/appwrite";
import { Query } from "appwrite";

const { t } = useI18n();
const { notify } = useNotifications();
const { databases, tables } = getAppwrite();
const config = useRuntimeConfig();

const props = defineProps<{
  settings: GameSettings;
  isEditable: boolean;
  lobbyId: string;
  hostUserId?: string;
}>();

const emit = defineEmits<{
  (e: "update:settings", settings: GameSettings): void;
}>();

const { saveGameSettings } = useGameSettings();
const localSettings = ref<GameSettings>({ ...props.settings });
const expanded = ref(false);

watch(
  () => props.settings,
  (newVal) => {
    localSettings.value = { ...newVal };
  },
  { deep: true },
);

const availablePacks = ref<string[]>([]);
const loadingPacks = ref(false);

const DB_ID = config.public.appwriteDatabaseId;
const CARD_COLLECTIONS = {
  black: config.public.appwriteBlackCardCollectionId as string,
  white: config.public.appwriteWhiteCardCollectionId as string,
};

onMounted(async () => {
  if (!databases) return;
  loadingPacks.value = true;
  try {
    const blackCountResult = await tables.listRows({ databaseId: DB_ID, tableId: CARD_COLLECTIONS.black, queries: [Query.limit(1)] });
    const totalBlackCards = blackCountResult.total;
    const chunkSize = 1000;
    const blackPacks = new Set<string>();

    for (let offset = 0; offset < totalBlackCards; offset += chunkSize) {
      const blackCardsChunk = await tables.listRows({ databaseId: DB_ID, tableId: CARD_COLLECTIONS.black, queries: [Query.limit(chunkSize), Query.offset(offset)] });
      blackCardsChunk.rows.forEach((card: any) => {
        if (card.pack && !card.disabled) blackPacks.add(card.pack);
      });
    }

    const whiteCountResult = await tables.listRows({ databaseId: DB_ID, tableId: CARD_COLLECTIONS.white, queries: [Query.limit(1)] });
    const totalWhiteCards = whiteCountResult.total;
    const whitePacks = new Set<string>();

    for (let offset = 0; offset < totalWhiteCards; offset += chunkSize) {
      const whiteCardsChunk = await tables.listRows({ databaseId: DB_ID, tableId: CARD_COLLECTIONS.white, queries: [Query.limit(chunkSize), Query.offset(offset)] });
      whiteCardsChunk.rows.forEach((card: any) => {
        if (card.pack && !card.disabled) whitePacks.add(card.pack);
      });
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

const saveSettings = async () => {
  try {
    await saveGameSettings(
      props.lobbyId,
      localSettings.value,
      props.hostUserId,
    );
    emit("update:settings", localSettings.value);
    notify({
      title: t("game.settings.updated"),
      icon: "i-solar-check-read-line-duotone",
      color: "success",
    });
  } catch (err) {
    console.error(err);
    notify({
      title: t("game.settings.update_failed"),
      icon: "i-solar-danger-circle-bold-duotone",
      color: "error",
    });
  }
};

const readOnlyMap = {
  lobbyName: t("game.settings.lobby_name"),
  maxPoints: t("game.settings.points_to_win"),
  numPlayerCards: t("game.settings.cards_per_player"),
  isPrivate: t("game.settings.is_private"),
  password: t("game.settings.lobby_password"),
  cardPacks: t("game.settings.card_packs"),
};

const formatValue = (key: keyof GameSettings) => {
  const value = props.settings[key];
  if (key === "isPrivate") return value ? "YES" : "NO";
  if (key === "cardPacks" && Array.isArray(value))
    return value.join(", ") || "—";
  return value || "—";
};
</script>

<style scoped>
/* ─── Panel shell ────────────────────────────────────────────── */
.settings-panel {
  background: rgba(10, 10, 24, 0.85);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 0.875rem;
  overflow: hidden;
}

/* ─── Collapsible header ─────────────────────────────────────── */
.settings-header {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.6rem 0.9rem;
  background: rgba(139, 92, 246, 0.05);
  border: none;
  border-bottom: 1px solid rgba(100, 116, 139, 0.12);
  cursor: pointer;
  gap: 0.5rem;
  transition: background 0.15s ease;
}

.settings-header:hover {
  background: rgba(139, 92, 246, 0.1);
}

.settings-header-left {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex: 1;
}

.settings-header-icon {
  color: #8b5cf6;
  font-size: 0.95rem;
}

.settings-header-title {
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  color: #64748b;
}

.settings-readonly-badge {
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: #64748b;
  background: rgba(100, 116, 139, 0.1);
  border: 1px solid rgba(100, 116, 139, 0.2);
  border-radius: 3px;
  padding: 1px 0.35rem;
}

.settings-chevron {
  font-size: 1rem;
  color: #475569;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.settings-chevron--open {
  transform: rotate(180deg);
}

/* ─── Collapsible transition ─────────────────────────────────── */
.settings-body-enter-active,
.settings-body-leave-active {
  transition:
    max-height 0.25s ease,
    opacity 0.2s ease;
  max-height: 600px;
  overflow: hidden;
}

.settings-body-enter-from,
.settings-body-leave-to {
  max-height: 0;
  opacity: 0;
}

/* ─── Body ───────────────────────────────────────────────────── */
.settings-body {
  padding: 0.85rem;
}

/* ─── Form layout ────────────────────────────────────────────── */
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.field-inline {
  flex-direction: row;
  align-items: center;
}

.field-label {
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  color: #64748b;
}

/* ─── Pack tags ──────────────────────────────────────────────── */
.pack-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.35rem;
}

.pack-tag {
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  color: #a78bfa;
  background: rgba(139, 92, 246, 0.12);
  border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: 4px;
  padding: 1px 0.4rem;
}

/* ─── Save button ────────────────────────────────────────────── */
.save-btn {
  margin-top: 0.25rem;
}

/* ─── Read-only grid ─────────────────────────────────────────── */
.settings-readonly {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.readonly-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.3rem 0;
  border-bottom: 1px solid rgba(100, 116, 139, 0.08);
}

.readonly-row:last-child {
  border-bottom: none;
}

.readonly-key {
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  color: #475569;
  flex: 0 0 40%;
}

.readonly-val {
  font-size: 0.78rem;
  color: #94a3b8;
  flex: 1;
  text-align: right;
  word-break: break-all;
}
</style>
