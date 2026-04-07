<script lang="ts" setup>
import { computed, nextTick, ref, watch, onMounted, onUnmounted } from "vue";
import { Filter } from "bad-words";
import { useUserPrefsStore } from "~/stores/userPrefsStore";
import { SFX } from "~/config/sfx.config";

const { t } = useI18n();
const prefs = useUserPrefsStore();
const { playSfx } = useSfx();
const { sanitize } = useSanitize();
const { reactive, lobbyDoc } = useLobby();
const chat = useLobbyChat(lobbyDoc);
const userStore = useUserStore();
const currentUserId = computed(() => userStore.user?.$id);

const filter = new Filter();
const maxLength = 255;

// ── Chat open/closed state ──
const isOpen = ref(false);
const newMessage = ref("");
const chatContainer = ref<HTMLDivElement | null>(null);
const inputRef = ref<HTMLTextAreaElement | null>(null);

// ── Visible (fading) messages ──
const MESSAGE_FADE_MS = 8000;
const visibleMessageIds = ref<Set<string>>(new Set());
const fadeTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ── Unread count (messages received while chat is closed) ──
const lastSeenCount = ref(0);
const unreadCount = computed(() => {
  const total = reactive.chat.value.length;
  return Math.max(0, total - lastSeenCount.value);
});

// Track new messages for fade-in/fade-out
watch(
  () => reactive.chat.value.length,
  (newCount, oldCount) => {
    if (newCount <= oldCount) return;

    const newMessages = reactive.chat.value.slice(oldCount);
    for (const msg of newMessages) {
      // Show the message
      visibleMessageIds.value.add(msg.id);

      // Clear any existing timer
      if (fadeTimers.has(msg.id)) clearTimeout(fadeTimers.get(msg.id)!);

      // Set fade-out timer (only when chat is closed)
      if (!isOpen.value) {
        fadeTimers.set(
          msg.id,
          setTimeout(() => {
            visibleMessageIds.value.delete(msg.id);
            fadeTimers.delete(msg.id);
          }, MESSAGE_FADE_MS),
        );
      }

      // Sound + TTS for other players' messages
      if (msg.userId !== currentUserId.value) {
        playSfx(SFX.chatReceive);
      }
    }
  },
);

// When chat opens, mark all as seen and clear fade timers
watch(isOpen, (open) => {
  if (open) {
    lastSeenCount.value = reactive.chat.value.length;
    // Keep all messages visible while open
    for (const [id, timer] of fadeTimers) {
      clearTimeout(timer);
      fadeTimers.delete(id);
    }
    // Make all messages visible
    for (const msg of reactive.chat.value) {
      visibleMessageIds.value.add(msg.id);
    }
    nextTick(() => {
      inputRef.value?.focus();
      scrollToBottom();
    });
  } else {
    lastSeenCount.value = reactive.chat.value.length;
    // Start fade timers for currently visible messages
    for (const id of visibleMessageIds.value) {
      if (!fadeTimers.has(id)) {
        fadeTimers.set(
          id,
          setTimeout(() => {
            visibleMessageIds.value.delete(id);
            fadeTimers.delete(id);
          }, MESSAGE_FADE_MS),
        );
      }
    }
  }
});

// Visible messages for idle state (only recent, fading ones)
const idleMessages = computed(() => {
  return reactive.chat.value.filter((msg) =>
    visibleMessageIds.value.has(msg.id),
  );
});

const isMessageEmpty = computed(() => !newMessage.value.trim());

function openChat() {
  isOpen.value = true;
}

function closeChat() {
  isOpen.value = false;
}

function toggleChat() {
  if (isOpen.value) closeChat();
  else openChat();
}

// ── Keyboard handling ──
function handleGlobalKeydown(e: KeyboardEvent) {
  // Don't intercept if user is typing in another input
  const active = document.activeElement;
  const isTyping =
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    (active as HTMLElement)?.isContentEditable;

  if (e.key === "t" && !isOpen.value && !isTyping) {
    e.preventDefault();
    openChat();
    return;
  }

  if (e.key === "Escape" && isOpen.value) {
    e.preventDefault();
    e.stopPropagation();
    closeChat();
    return;
  }
}

function handleInputKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!isMessageEmpty.value) {
      sendMessage();
    } else {
      closeChat();
    }
  }
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closeChat();
  }
}

onMounted(() => window.addEventListener("keydown", handleGlobalKeydown, true));
onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeydown, true);
  for (const timer of fadeTimers.values()) clearTimeout(timer);
});

// ── Helpers ──
function uidToHSLColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${hash % 360}, 65%, 55%)`;
}

const safeText = (text: string) => {
  const sanitized = sanitize(text);
  return prefs.chatProfanityFilter ? filter.clean(sanitized) : sanitized;
};

function scrollToBottom() {
  if (!chatContainer.value) return;
  chatContainer.value.scrollTo({
    top: chatContainer.value.scrollHeight,
    behavior: "smooth",
  });
}

function sendMessage() {
  const trimmed = newMessage.value.trim();
  if (!trimmed) return;
  const stripped = sanitize(
    trimmed.replace(/[\u0000-\u001F\u007F-\u009F]/g, ""),
  ).substring(0, maxLength);
  if (!stripped) return;
  chat.sendMessage(stripped);
  newMessage.value = "";
  playSfx(SFX.chatSend);
  nextTick(() => scrollToBottom());
}

// Expose for parent (CornerControls button)
defineExpose({ toggleChat, unreadCount });
</script>

<template>
  <div class="game-chat-overlay">
    <!-- Idle state: fading messages -->
    <TransitionGroup
      v-if="!isOpen"
      name="chat-fade"
      tag="div"
      class="chat-idle-messages"
    >
      <div
        v-for="msg in idleMessages"
        :key="msg.id"
        class="chat-idle-row"
        :class="{ 'chat-idle-row--system': msg.isSystem }"
      >
        <template v-if="msg.isSystem">
          <span class="idle-sys-badge">SYS</span>
          <span class="idle-sys-text">{{ safeText(msg.text) }}</span>
        </template>
        <template v-else>
          <span
            class="idle-name"
            :style="{ color: uidToHSLColor(msg.userId) }"
          >
            {{ msg.name }}:
          </span>
          <span class="idle-text">{{ safeText(msg.text) }}</span>
        </template>
      </div>
    </TransitionGroup>

    <!-- Open state: full chat -->
    <Transition name="chat-panel">
      <div v-if="isOpen" class="chat-open-panel">
        <!-- Message history -->
        <div ref="chatContainer" class="chat-history">
          <div v-if="reactive.chat.value.length === 0" class="chat-empty">
            {{ t("chat.no_messages", "No messages yet") }}
          </div>
          <div
            v-for="msg in reactive.chat.value"
            :key="msg.id"
            class="chat-msg-row"
            :class="{
              'chat-msg-row--system': msg.isSystem,
              'chat-msg-row--mine': msg.userId === currentUserId,
            }"
          >
            <template v-if="msg.isSystem">
              <span class="msg-sys-badge">SYS</span>
              <span class="msg-sys-text">{{ safeText(msg.text) }}</span>
            </template>
            <template v-else>
              <span
                class="msg-name"
                :style="{ color: uidToHSLColor(msg.userId) }"
              >
                {{ msg.name }}:
              </span>
              <span class="msg-text">{{ safeText(msg.text) }}</span>
            </template>
          </div>
        </div>

        <!-- Input -->
        <div class="chat-input-row">
          <textarea
            ref="inputRef"
            v-model="newMessage"
            class="chat-input"
            :placeholder="t('chat.placeholder', 'Type a message...')"
            rows="1"
            :maxlength="maxLength"
            @keydown="handleInputKeydown"
          />
          <button
            class="chat-send-btn"
            :class="{ 'chat-send-btn--ready': !isMessageEmpty }"
            :disabled="isMessageEmpty"
            @click="sendMessage"
          >
            <UIcon name="i-solar-plain-bold-duotone" />
          </button>
        </div>

        <div class="chat-hint">
          Press <kbd>ESC</kbd> or <kbd>Enter</kbd> to close
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.game-chat-overlay {
  position: fixed;
  bottom: 160px; /* above the hand */
  left: 16px;
  z-index: 60;
  max-width: 380px;
  width: 100%;
  pointer-events: none;
}

/* ─── Idle messages (fade in/out) ──────────────────────────── */
.chat-idle-messages {
  display: flex;
  flex-direction: column;
  gap: 3px;
  pointer-events: none;
}

.chat-idle-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 3px 10px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  border-radius: 6px;
  width: fit-content;
  max-width: 100%;
}

.chat-idle-row--system {
  opacity: 0.7;
}

.idle-name {
  font-size: 0.78rem;
  font-weight: 600;
  flex-shrink: 0;
}

.idle-text {
  font-size: 0.8rem;
  color: #e2e8f0;
  word-break: break-word;
}

.idle-sys-badge {
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.15);
  padding: 1px 4px;
  border-radius: 3px;
  flex-shrink: 0;
}

.idle-sys-text {
  font-size: 0.75rem;
  color: #fde68a;
  font-style: italic;
}

/* Fade transitions */
.chat-fade-enter-active {
  transition: all 0.3s ease;
}
.chat-fade-leave-active {
  transition: all 0.6s ease;
}
.chat-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.chat-fade-leave-to {
  opacity: 0;
}

/* ─── Open panel ──────────────────────────────────────────── */
.chat-open-panel {
  background: rgba(10, 10, 24, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  pointer-events: all;
}

.chat-history {
  max-height: 240px;
  overflow-y: auto;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  scrollbar-width: thin;
  scrollbar-color: rgba(139, 92, 246, 0.2) transparent;
}

.chat-history::-webkit-scrollbar {
  width: 3px;
}

.chat-history::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.25);
  border-radius: 99px;
}

.chat-empty {
  padding: 16px;
  text-align: center;
  color: #475569;
  font-size: 0.8rem;
  font-style: italic;
}

.chat-msg-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  line-height: 1.4;
}

.chat-msg-row--system {
  opacity: 0.7;
}

.msg-name {
  font-size: 0.78rem;
  font-weight: 600;
  flex-shrink: 0;
}

.msg-text {
  font-size: 0.8rem;
  color: #cbd5e1;
  word-break: break-word;
}

.msg-sys-badge {
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.15);
  padding: 1px 4px;
  border-radius: 3px;
  flex-shrink: 0;
}

.msg-sys-text {
  font-size: 0.75rem;
  color: #fde68a;
  font-style: italic;
}

/* ─── Input row ──────────────────────────────────────────── */
.chat-input-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 6px 10px;
  border-top: 1px solid rgba(71, 85, 105, 0.2);
  background: rgba(15, 23, 42, 0.5);
}

.chat-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #e2e8f0;
  font-size: 0.82rem;
  resize: none;
  overflow: hidden;
  line-height: 1.5;
  padding: 4px 0;
  max-height: 60px;
}

.chat-input::placeholder {
  color: #475569;
}

.chat-send-btn {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid rgba(71, 85, 105, 0.2);
  background: rgba(51, 65, 85, 0.4);
  color: #475569;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.chat-send-btn--ready {
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.3);
}

.chat-send-btn--ready:hover {
  background: rgba(139, 92, 246, 0.25);
}

.chat-hint {
  text-align: center;
  font-size: 0.65rem;
  color: #475569;
  padding: 4px;
}

.chat-hint kbd {
  background: rgba(51, 65, 85, 0.5);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 0.6rem;
}

/* Panel transition */
.chat-panel-enter-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.chat-panel-leave-active {
  transition: all 0.15s ease;
}
.chat-panel-enter-from,
.chat-panel-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
