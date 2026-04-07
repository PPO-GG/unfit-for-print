<script lang="ts" setup>
import type { LobbySettings } from "~/composables/useLobbyReactive";
import { useUserPrefsStore } from "~/stores/userPrefsStore";

const { t } = useI18n();
const prefs = useUserPrefsStore();

const props = defineProps<{
  open: boolean;
  lobbyCode?: string;
  isHost?: boolean;
  gameSettings?: LobbySettings | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "leave"): void;
  (e: "toggle-chat"): void;
  (e: "skip-judge"): void;
  (e: "reset-game"): void;
}>();

type View = "main" | "my-settings" | "game-settings" | "host-tools";
const activeView = ref<View>("main");
const copied = ref(false);
const showResetConfirm = ref(false);

function copyInviteLink() {
  const url = `${window.location.origin}/game/${props.lobbyCode}`;
  navigator.clipboard.writeText(url);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

function goBack() {
  activeView.value = "main";
  showResetConfirm.value = false;
}

// Reset view when menu closes
watch(
  () => props.open,
  (open) => {
    if (!open) {
      activeView.value = "main";
      showResetConfirm.value = false;
    }
  },
);

// ESC key handling is done by the parent (GameBoard) to avoid double-toggle
</script>

<template>
  <Teleport to="body">
    <Transition name="esc-menu">
      <div v-if="open" class="esc-menu-backdrop" @click.self="emit('close')">
        <div class="esc-menu-panel">
          <!-- ═══ Main View ═══ -->
          <template v-if="activeView === 'main'">
            <h2 class="esc-menu-title">{{ t("game.menu_title", "Game Menu") }}</h2>

            <div class="esc-menu-items">
              <button class="esc-menu-item" @click="emit('toggle-chat')">
                <UIcon name="i-solar-chat-round-dots-bold-duotone" />
                <span>{{ t("game.chat", "Chat") }}</span>
                <kbd class="esc-menu-kbd">T</kbd>
              </button>

              <button class="esc-menu-item" @click="activeView = 'my-settings'">
                <UIcon name="i-solar-user-bold-duotone" />
                <span>{{ t("game.my_settings", "My Settings") }}</span>
                <UIcon name="i-solar-alt-arrow-right-bold" class="esc-menu-arrow" />
              </button>

              <button
                v-if="isHost && gameSettings"
                class="esc-menu-item"
                @click="activeView = 'game-settings'"
              >
                <UIcon name="i-solar-settings-bold-duotone" />
                <span>{{ t("game.settings", "Game Settings") }}</span>
                <UIcon name="i-solar-alt-arrow-right-bold" class="esc-menu-arrow" />
              </button>

              <button
                v-if="isHost"
                class="esc-menu-item"
                @click="activeView = 'host-tools'"
              >
                <UIcon name="i-solar-crown-bold-duotone" />
                <span>{{ t("game.host_tools", "Host Tools") }}</span>
                <UIcon name="i-solar-alt-arrow-right-bold" class="esc-menu-arrow" />
              </button>

              <div class="esc-menu-divider" />

              <button class="esc-menu-item" @click="copyInviteLink">
                <UIcon
                  :name="
                    copied
                      ? 'i-solar-check-circle-bold-duotone'
                      : 'i-solar-link-bold-duotone'
                  "
                />
                <span>{{
                  copied
                    ? t("game.link_copied", "Link Copied!")
                    : t("game.copy_invite", "Copy Invite Link")
                }}</span>
              </button>

              <button class="esc-menu-item esc-menu-item--danger" @click="emit('leave')">
                <UIcon name="i-solar-logout-2-bold-duotone" />
                <span>{{ t("game.leave", "Leave Game") }}</span>
              </button>
            </div>

            <p class="esc-menu-hint">
              {{ t("game.press_esc", "Press ESC to close") }}
            </p>
          </template>

          <!-- ═══ My Settings View ═══ -->
          <template v-else-if="activeView === 'my-settings'">
            <div class="esc-menu-view-header">
              <button class="esc-menu-back" @click="goBack">
                <UIcon name="i-solar-alt-arrow-left-bold" />
              </button>
              <h2 class="esc-menu-title">{{ t("game.my_settings", "My Settings") }}</h2>
            </div>

            <div class="esc-menu-settings">
              <div class="setting-row">
                <span class="setting-label">{{ t("chat.tts", "Text-to-Speech") }}</span>
                <USwitch v-model="prefs.ttsEnabled" size="xs" />
              </div>

              <div class="setting-row">
                <span class="setting-label">{{ t("chat.profanity_filter", "Profanity Filter") }}</span>
                <USwitch v-model="prefs.chatProfanityFilter" size="xs" />
              </div>

              <div class="setting-group">
                <span class="setting-label">{{ t("game.tts_voice", "TTS Voice") }}</span>
                <VoiceSwitcher />
              </div>

              <div class="setting-group">
                <span class="setting-label">{{ t("game.language", "Language") }}</span>
                <LanguageSwitcher />
              </div>
            </div>
          </template>

          <!-- ═══ Game Settings View ═══ -->
          <template v-else-if="activeView === 'game-settings' && gameSettings">
            <div class="esc-menu-view-header">
              <button class="esc-menu-back" @click="goBack">
                <UIcon name="i-solar-alt-arrow-left-bold" />
              </button>
              <h2 class="esc-menu-title">{{ t("game.settings", "Game Settings") }}</h2>
            </div>

            <div class="esc-menu-settings">
              <GameSettings
                :is-editable="isHost ?? false"
                :settings="gameSettings"
                inline
              />
            </div>
          </template>

          <!-- ═══ Host Tools View ═══ -->
          <template v-else-if="activeView === 'host-tools'">
            <div class="esc-menu-view-header">
              <button class="esc-menu-back" @click="goBack">
                <UIcon name="i-solar-alt-arrow-left-bold" />
              </button>
              <h2 class="esc-menu-title">{{ t("game.host_tools", "Host Tools") }}</h2>
            </div>

            <div class="esc-menu-items">
              <button class="esc-menu-item" @click="emit('skip-judge')">
                <UIcon name="i-solar-skip-next-bold-duotone" />
                <span>{{ t("game.skip_judge", "Skip Judge") }}</span>
              </button>

              <div class="esc-menu-divider" />

              <template v-if="!showResetConfirm">
                <button
                  class="esc-menu-item esc-menu-item--danger"
                  @click="showResetConfirm = true"
                >
                  <UIcon name="i-solar-restart-bold-duotone" />
                  <span>{{ t("game.reset_game", "Reset Game") }}</span>
                </button>
              </template>
              <template v-else>
                <p class="reset-confirm-text">
                  {{ t("game.reset_confirm", "Are you sure? This ends the current game.") }}
                </p>
                <div class="reset-confirm-btns">
                  <button class="confirm-btn confirm-btn--cancel" @click="showResetConfirm = false">
                    {{ t("common.cancel", "Cancel") }}
                  </button>
                  <button class="confirm-btn confirm-btn--danger" @click="emit('reset-game')">
                    {{ t("game.reset_game", "Reset") }}
                  </button>
                </div>
              </template>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.esc-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(2, 6, 23, 0.7);
  backdrop-filter: blur(8px);
}

.esc-menu-panel {
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: 16px;
  padding: 2rem 2.5rem;
  min-width: 320px;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow:
    0 0 60px rgba(139, 92, 246, 0.1),
    0 25px 50px rgba(0, 0, 0, 0.5);
  scrollbar-width: thin;
  scrollbar-color: rgba(139, 92, 246, 0.2) transparent;
}

.esc-menu-panel::-webkit-scrollbar {
  width: 3px;
}

.esc-menu-panel::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.25);
  border-radius: 99px;
}

/* ─── View header with back button ─────────────────────────── */
.esc-menu-view-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.esc-menu-view-header .esc-menu-title {
  margin-bottom: 0;
  text-align: left;
  flex: 1;
}

.esc-menu-back {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(71, 85, 105, 0.2);
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 1rem;
  flex-shrink: 0;
}

.esc-menu-back:hover {
  background: rgba(139, 92, 246, 0.12);
  border-color: rgba(139, 92, 246, 0.3);
  color: #e2e8f0;
}

/* ─── Title ────────────────────────────────────────────────── */
.esc-menu-title {
  text-align: center;
  font-size: 1.25rem;
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 1.5rem;
  letter-spacing: -0.025em;
}

/* ─── Menu items ───────────────────────────────────────────── */
.esc-menu-items {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.esc-menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(71, 85, 105, 0.2);
  color: #cbd5e1;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.esc-menu-item:hover {
  background: rgba(139, 92, 246, 0.12);
  border-color: rgba(139, 92, 246, 0.3);
  color: #e2e8f0;
}

.esc-menu-item--danger:hover {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.esc-menu-kbd {
  margin-left: auto;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(51, 65, 85, 0.5);
  font-size: 0.7rem;
  font-weight: 600;
  color: #64748b;
  letter-spacing: 0.05em;
}

.esc-menu-arrow {
  margin-left: auto;
  font-size: 0.85rem;
  color: #64748b;
}

.esc-menu-divider {
  height: 1px;
  background: rgba(71, 85, 105, 0.3);
  margin: 0.375rem 0;
}

.esc-menu-hint {
  text-align: center;
  font-size: 0.75rem;
  color: #475569;
  margin-top: 1.25rem;
}

/* ─── Settings views ───────────────────────────────────────── */
.esc-menu-settings {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem 0;
}

.setting-label {
  font-size: 0.85rem;
  color: #94a3b8;
}

/* ─── Reset confirmation ───────────────────────────────────── */
.reset-confirm-text {
  font-size: 0.85rem;
  color: #f87171;
  text-align: center;
  padding: 0.5rem 0;
}

.reset-confirm-btns {
  display: flex;
  gap: 0.5rem;
}

.confirm-btn {
  flex: 1;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid;
}

.confirm-btn--cancel {
  background: rgba(30, 41, 59, 0.5);
  border-color: rgba(71, 85, 105, 0.3);
  color: #94a3b8;
}

.confirm-btn--cancel:hover {
  background: rgba(30, 41, 59, 0.8);
  color: #e2e8f0;
}

.confirm-btn--danger {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #f87171;
}

.confirm-btn--danger:hover {
  background: rgba(239, 68, 68, 0.25);
  color: #fca5a5;
}

/* ─── Transitions ──────────────────────────────────────────── */
.esc-menu-enter-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.esc-menu-leave-active {
  transition: all 0.2s ease;
}
.esc-menu-enter-from {
  opacity: 0;
}
.esc-menu-enter-from .esc-menu-panel {
  transform: scale(0.95);
  opacity: 0;
}
.esc-menu-leave-to {
  opacity: 0;
}
.esc-menu-leave-to .esc-menu-panel {
  transform: scale(0.95);
  opacity: 0;
}
</style>
