<template>
  <div class="chat-panel">
    <!-- ─── Header ──────────────────────────────── -->
    <div class="chat-header">
      <div class="chat-header-left">
        <span class="chat-live-dot" />
        <Icon name="solar:chat-round-bold-duotone" class="chat-header-icon" />
        <span class="chat-header-title">CHAT</span>
      </div>
      <button
        class="chat-gear-btn"
        :class="{ 'chat-gear-btn--active': showSettings }"
        :title="t('chat.settings') ?? 'Settings'"
        @click="showSettings = !showSettings"
      >
        <Icon name="solar:settings-minimalistic-bold-duotone" />
      </button>
    </div>

    <!-- ─── Settings drawer ────────────────────────── -->
    <Transition name="settings-slide">
      <div v-if="showSettings" class="chat-settings">
        <USwitch
          v-model="prefs.ttsEnabled"
          label="TTS"
          :description="t('chat.tts_description')"
          size="xs"
        />
        <USwitch
          v-model="prefs.chatProfanityFilter"
          label="Profanity Filter"
          :description="t('chat.profanity_description')"
          size="xs"
        />
      </div>
    </Transition>

    <!-- ─── Messages feed ─────────────────────────── -->
    <div class="chat-feed-wrap">
      <div ref="chatContainer" class="chat-feed" @scroll="handleScroll">
        <!-- Empty state -->
        <div v-if="reactive.chat.value.length === 0" class="chat-empty">
          <Icon name="solar:chat-round-bold-duotone" class="chat-empty-icon" />
          <span>{{ t("chat.no_messages") }}</span>
        </div>

        <!-- Message rows -->
        <TransitionGroup name="chat-msg" tag="div" class="chat-messages">
          <div
            v-for="msg in reactive.chat.value"
            :key="msg.id"
            class="chat-row"
            :class="{
              'chat-row--system': msg.isSystem,
              'chat-row--mine': msg.userId === currentUserId,
            }"
          >
            <!-- System message -->
            <template v-if="msg.isSystem">
              <span class="sys-pill">
                <Icon name="solar:server-square-bold-duotone" class="sys-icon" />
                SERVER
              </span>
              <span class="sys-text">{{ safeText(msg.text) }}</span>
            </template>

            <!-- User message -->
            <template v-else>
              <span
                class="name-pill"
                :style="{ '--name-color': uidToHSLColor(msg.userId) }"
              >
                {{ msg.name }}
              </span>
              <span class="msg-text">{{ safeText(msg.text) }}</span>
            </template>
          </div>
        </TransitionGroup>
      </div>

      <!-- New messages indicator -->
      <Transition name="new-msg-fade">
        <button v-if="!isAtBottom" class="new-msg-btn" @click="scrollToBottom">
          <Icon name="solar:arrow-down-bold" />
          New messages
        </button>
      </Transition>
    </div>

    <!-- ─── Input bar ────────────────────────────── -->
    <div class="chat-input-bar">
      <textarea
        v-model="newMessage"
        class="chat-textarea"
        :placeholder="t('chat.placeholder')"
        rows="1"
        :maxlength="maxLength"
        aria-describedby="character-count"
        @keydown.enter.exact.prevent="!isMessageEmpty && sendMessage()"
        @input="autoResize"
      />
      <div class="chat-input-actions">
        <span
          id="character-count"
          class="char-count"
          aria-live="polite"
          role="status"
        >
          {{ newMessage?.length ?? 0 }}/{{ maxLength }}
        </span>
        <button
          class="send-btn"
          :class="{ 'send-btn--ready': !isMessageEmpty }"
          :disabled="isMessageEmpty"
          @click="sendMessage"
        >
          <Icon name="solar:plain-bold-duotone" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Filter } from "bad-words";
import { useBrowserSpeech } from "~/composables/useBrowserSpeech";
import { useSpeech } from "~/composables/useSpeech";
import { useUserPrefsStore } from "~/stores/userPrefsStore";
import { SFX } from "~/config/sfx.config";

const elevenLabsVoiceId = "NuIlfu52nTXRM2NXDrjS";
const browserSpeech = useBrowserSpeech();
const elevenLabsSpeech = useSpeech({ elevenLabsVoiceId });
const prefs = useUserPrefsStore();
const { t } = useI18n();
const maxLength = 255;
const { playSfx } = useSfx();
const { sanitize } = useSanitize();

const { reactive, lobbyDoc } = useLobby();
const chat = useLobbyChat(lobbyDoc);

const userStore = useUserStore();
const currentUserId = computed(() => userStore.user?.$id);

const newMessage = ref("");
const chatContainer = ref<HTMLDivElement | null>(null);
const isAtBottom = ref(true);
const showSettings = ref(false);

const isMessageEmpty = computed(() => !newMessage.value.trim());
const filter = new Filter();

const speak = (text: string) => {
  if (prefs.ttsVoice === elevenLabsVoiceId) {
    elevenLabsSpeech.speak("elevenlabs", text);
  } else {
    browserSpeech.speak(text);
  }
};

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

const autoResize = (e: Event) => {
  const target = e.target as HTMLTextAreaElement;
  target.style.height = "auto";
  target.style.height = `${target.scrollHeight}px`;
  nextTick(() => (target.scrollTop = target.scrollHeight));
};

const scrollToBottom = () => {
  if (!chatContainer.value) return;
  chatContainer.value.scrollTo({
    top: chatContainer.value.scrollHeight,
    behavior: "smooth",
  });
  isAtBottom.value = true;
};

const checkIfAtBottom = () => {
  if (!chatContainer.value) return;
  const { scrollTop, scrollHeight, clientHeight } = chatContainer.value;
  isAtBottom.value = scrollHeight - scrollTop - clientHeight < 50;
};

const handleScroll = () => {
  checkIfAtBottom();
};

// Auto-scroll when messages change (if already at bottom)
watch(
  () => reactive.chat.value.length,
  () => {
    nextTick(() => {
      if (isAtBottom.value) scrollToBottom();
    });
  },
);

// Sound + TTS for incoming messages from other players
watch(
  () => reactive.chat.value.length,
  (newCount, oldCount) => {
    if (newCount > oldCount) {
      const newMessages = reactive.chat.value.slice(oldCount);
      for (const msg of newMessages) {
        if (msg.userId !== currentUserId.value) {
          playSfx(SFX.chatReceive);
          if (prefs.ttsEnabled && msg.text) {
            speak(`${msg.name} says: ${msg.text}`);
          }
        }
      }
    }
  },
);

const sendMessage = () => {
  const trimmed = newMessage.value.trim();
  if (!trimmed) return;

  // Client-side sanitization: strip control chars, HTML tags, truncate
  const stripped = trimmed
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/<[^>]*>/g, "")
    .substring(0, maxLength);

  if (!stripped) return;

  chat.sendMessage(stripped);
  newMessage.value = "";
  playSfx(SFX.chatSend);
  nextTick(() => scrollToBottom());
};
</script>

<style scoped>
/* ─── Panel shell ────────────────────────────────────────────── */
.chat-panel {
  background: rgba(10, 10, 24, 0.85);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 0.875rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ─── Header ─────────────────────────────────────────────────── */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.55rem 0.9rem;
  border-bottom: 1px solid rgba(100, 116, 139, 0.12);
  background: rgba(139, 92, 246, 0.05);
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.chat-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow:
    0 0 6px #22c55e,
    0 0 12px #22c55e66;
  animation: live-pulse 2.5s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes live-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.chat-header-icon {
  font-size: 0.95rem;
  color: #8b5cf6;
}

.chat-header-title {
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  color: #64748b;
}

.chat-gear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: #64748b;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 1rem;
}

.chat-gear-btn:hover {
  color: #a78bfa;
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.2);
}

.chat-gear-btn--active {
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.12);
  border-color: rgba(139, 92, 246, 0.3);
}

/* ─── Settings drawer ────────────────────────────────────────── */
.chat-settings {
  padding: 0.75rem 0.9rem;
  border-bottom: 1px solid rgba(100, 116, 139, 0.12);
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  overflow: hidden;
}

.settings-slide-enter-active,
.settings-slide-leave-active {
  transition:
    max-height 0.2s ease,
    opacity 0.2s ease;
  max-height: 120px;
}

.settings-slide-enter-from,
.settings-slide-leave-to {
  max-height: 0;
  opacity: 0;
}

/* ─── Error banner ───────────────────────────────────────────── */
.chat-error {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  background: rgba(239, 68, 68, 0.12);
  border-bottom: 1px solid rgba(239, 68, 68, 0.25);
  color: #f87171;
  font-size: 0.78rem;
}

/* ─── Feed wrapper ───────────────────────────────────────────── */
.chat-feed-wrap {
  position: relative;
  flex: 1;
}

.chat-feed {
  max-height: 240px;
  overflow-y: auto;
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(139, 92, 246, 0.2) transparent;
}

.chat-feed::-webkit-scrollbar {
  width: 3px;
}

.chat-feed::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.25);
  border-radius: 99px;
}

/* ─── Empty state ────────────────────────────────────────────── */
.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 1.5rem;
  color: #334155;
  font-size: 0.8rem;
  font-style: italic;
  text-align: center;
}

.chat-empty-icon {
  font-size: 1.8rem;
  opacity: 0.3;
}

/* ─── Load older ─────────────────────────────────────────────── */
.load-older-btn {
  display: block;
  width: 100%;
  text-align: center;
  padding: 0.3rem;
  font-size: 0.72rem;
  color: #8b5cf6;
  cursor: pointer;
  background: transparent;
  border: none;
  transition: color 0.15s ease;
  letter-spacing: 0.05em;
}

.load-older-btn:hover {
  color: #a78bfa;
}
.load-older-btn:disabled {
  color: #475569;
  cursor: not-allowed;
}

/* ─── Messages ───────────────────────────────────────────────── */
.chat-messages {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.chat-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.35rem;
  line-height: 1.4;
}

/* Slide-in animation for new messages */
.chat-msg-enter-active {
  transition: all 0.2s ease;
}
.chat-msg-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

/* Name pill */
.name-pill {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: var(--name-color, #a78bfa);
  background: color-mix(in srgb, var(--name-color, #8b5cf6) 12%, transparent);
  border: 1px solid
    color-mix(in srgb, var(--name-color, #8b5cf6) 25%, transparent);
  border-radius: 4px;
  padding: 1px 0.35rem;
  flex-shrink: 0;
  line-height: 1.6;
}

/* Message text */
.msg-text {
  font-size: 0.8rem;
  color: #cbd5e1;
  word-break: break-word;
}

/* System messages */
.chat-row--system {
  align-items: center;
}

.sys-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;

  font-size: 0.65rem;
  letter-spacing: 0.12em;
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 4px;
  padding: 1px 0.4rem;
  flex-shrink: 0;
}

.sys-icon {
  font-size: 0.6rem;
}

.sys-text {
  font-size: 0.78rem;
  color: #fde68a;
  font-style: italic;
}

/* ─── New message btn ────────────────────────────────────────── */
.new-msg-btn {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.75rem;
  background: rgba(139, 92, 246, 0.9);
  color: white;
  border: none;
  border-radius: 99px;
  font-size: 0.7rem;

  letter-spacing: 0.08em;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
  transition: background 0.15s ease;
  white-space: nowrap;
}

.new-msg-btn:hover {
  background: rgba(139, 92, 246, 1);
}

.new-msg-fade-enter-active,
.new-msg-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.new-msg-fade-enter-from,
.new-msg-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(6px);
}

/* ─── Input bar ──────────────────────────────────────────────── */
.chat-input-bar {
  display: flex;
  align-items: flex-end;
  gap: 0;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid rgba(100, 116, 139, 0.12);
  background: rgba(15, 23, 42, 0.6);
}

.chat-textarea {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #e2e8f0;
  font-size: 0.82rem;
  resize: none;
  overflow: hidden;
  line-height: 1.5;
  padding: 0.2rem 0;
  max-height: 80px;
}

.chat-textarea::placeholder {
  color: #475569;
}

.chat-input-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  padding-left: 0.5rem;
}

.char-count {
  font-size: 0.65rem;
  color: #475569;
  font-variant-numeric: tabular-nums;
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(100, 116, 139, 0.2);
  background: rgba(51, 65, 85, 0.5);
  color: #475569;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.send-btn--ready {
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.35);
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.2);
}

.send-btn--ready:hover {
  background: rgba(139, 92, 246, 0.25);
  box-shadow: 0 0 16px rgba(139, 92, 246, 0.35);
}

.send-btn:disabled:not(.send-btn--ready) {
  cursor: not-allowed;
  opacity: 0.4;
}
</style>
