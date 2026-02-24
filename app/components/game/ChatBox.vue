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

    <!-- ─── Error banner ──────────────────────────── -->
    <div v-if="errorMessage" class="chat-error">
      <Icon name="solar:danger-triangle-bold-duotone" />
      {{ errorMessage }}
    </div>

    <!-- ─── Messages feed ─────────────────────────── -->
    <div class="chat-feed-wrap">
      <div ref="chatContainer" class="chat-feed" @scroll="handleScroll">
        <!-- Load older -->
        <button
          v-if="hasMore"
          class="load-older-btn"
          :disabled="loadingMore"
          @click="loadOlderMessages"
        >
          {{ loadingMore ? t("chat.loading") : t("chat.load_more") }}
        </button>

        <!-- Empty state -->
        <div v-if="messages.length === 0" class="chat-empty">
          <Icon name="solar:chat-round-bold-duotone" class="chat-empty-icon" />
          <span>{{ t("chat.no_messages") }}</span>
        </div>

        <!-- Message rows -->
        <TransitionGroup name="chat-msg" tag="div" class="chat-messages">
          <div
            v-for="msg in messages"
            :key="msg.$id"
            class="chat-row"
            :class="{
              'chat-row--system': msg.senderId === 'system',
              'chat-row--mine': msg.senderId === currentUserId,
            }"
          >
            <!-- System message -->
            <template v-if="msg.senderId === 'system'">
              <span class="sys-pill">
                <Icon
                  name="solar:server-square-bold-duotone"
                  class="sys-icon"
                />
                SERVER
              </span>
              <span class="sys-text">{{ safeText(msg.text) }}</span>
            </template>

            <!-- User message -->
            <template v-else>
              <span
                class="name-pill"
                :style="{ '--name-color': uidToHSLColor(msg.senderId) }"
              >
                {{ msg.senderName }}
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
        ref="chatInput"
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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { getAppwrite } from "~/utils/appwrite";
import { useUserStore } from "~/stores/userStore";
import { Filter } from "bad-words";
import { Query, type Models } from "appwrite";
import { useBrowserSpeech } from "~/composables/useBrowserSpeech";
import { useSpeech } from "~/composables/useSpeech";
import { useUserPrefsStore } from "~/stores/userPrefsStore";
import { resolveId } from "~/utils/resolveId";
import { SFX } from "~/config/sfx.config";

const elevenLabsVoiceId = "NuIlfu52nTXRM2NXDrjS";
const browserSpeech = useBrowserSpeech();
const elevenLabsSpeech = useSpeech({ elevenLabsVoiceId });
const prefs = useUserPrefsStore();
const { t } = useI18n();
const maxLength = 255;
const { playSfx } = useSfx();
const autoResize = (e: Event) => {
  const target = e.target as HTMLTextAreaElement;
  target.style.height = "auto";
  target.style.height = `${target.scrollHeight}px`;
  nextTick(() => (target.scrollTop = target.scrollHeight));
};

const speak = (text: string) => {
  if (prefs.ttsVoice === elevenLabsVoiceId) {
    elevenLabsSpeech.speak("elevenlabs", text);
  } else {
    browserSpeech.speak(text);
  }
};

interface ChatMessage extends Models.Document {
  lobbyId: string;
  senderId: string;
  senderName: string;
  text: string;
  timeStamp: string;
  type?: "user" | "system";
}

const props = withDefaults(
  defineProps<{
    lobbyId?: string;
  }>(),
  {
    lobbyId: "",
  },
);
const { sanitize } = useSanitize();
const { databases, tables, client } = getAppwrite();
const userStore = useUserStore();
const config = useRuntimeConfig();
const dbId = config.public.appwriteDatabaseId;
const messagesCollectionId = config.public.appwriteGamechatCollectionId;

const messages = ref<ChatMessage[]>([]);
const newMessage = ref("");
const safeText = (text: string) => sanitize(text);
const chatContainer = ref<HTMLDivElement | null>(null);
const isAtBottom = ref(true);
const errorMessage = ref<string | null>(null);
const showSettings = ref(false);
const currentUserId = computed(() => userStore.user?.$id);

// Track optimistically-inserted message IDs so the Realtime echo can be deduped
const optimisticIds = new Set<string>();

const isMessageEmpty = computed(() => !newMessage.value.trim());
const hasMore = ref(false);
const loadingMore = ref(false);
const MESSAGES_PER_PAGE = 100;

const filter = new Filter();

function uidToHSLColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = hash % 360;
  const saturation = 65;
  const lightness = 55;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

const applyFilters = (doc: any): ChatMessage => {
  const text = Array.isArray(doc.text) ? doc.text.join(" ") : doc.text;
  const safe = sanitize(text);
  return {
    ...doc,
    text: prefs.chatProfanityFilter ? filter.clean(safe) : safe,
  };
};

const loadMessages = async () => {
  try {
    errorMessage.value = null;

    if (!props.lobbyId) {
      errorMessage.value = t("chat.error_loading_messages");
      return () => {};
    }

    // Load the latest N messages (descending), then reverse for display
    const res = await tables.listRows({ databaseId: dbId, tableId: messagesCollectionId, queries: [
              Query.equal("lobbyId", props.lobbyId),
              Query.orderDesc("timeStamp"),
              Query.limit(MESSAGES_PER_PAGE),
            ] });

    hasMore.value = res.total > res.rows.length;
    messages.value = res.rows.reverse().map(applyFilters) as ChatMessage[];

    return client.subscribe(
      `databases.${dbId}.collections.${messagesCollectionId}.rows`,
      (e: any) => {
        if (e.events.includes("databases.*.collections.*.rows.*.create")) {
          const doc = e.payload as ChatMessage;
          const docLobbyId = resolveId(doc.lobbyId);

          if (props.lobbyId && docLobbyId === props.lobbyId) {
            // Dedup: skip if this message was already optimistically inserted
            if (optimisticIds.has(doc.$id)) {
              optimisticIds.delete(doc.$id);
              return;
            }

            // Race-condition guard: if the realtime echo arrives before $fetch
            // returns, optimisticIds won't have the real ID yet. Detect this by
            // checking for a pending optimistic message from the same sender.
            if (doc.senderId === userStore.user?.$id) {
              const pendingIdx = messages.value.findIndex(
                (m) =>
                  m.$id.startsWith("__optimistic_") &&
                  m.senderId === doc.senderId,
              );
              if (pendingIdx !== -1) {
                // Replace the optimistic placeholder with the real message
                const safeDoc = applyFilters(doc);
                messages.value.splice(pendingIdx, 1, safeDoc);
                // Mark as handled so the later $fetch dedup also skips it
                optimisticIds.add(doc.$id);
                return;
              }
            }

            const safeDoc = applyFilters(doc);
            messages.value.push(safeDoc);
            if (safeDoc.senderId !== userStore.user?.$id) {
              playSfx(SFX.chatReceive);
            }

            if (prefs.ttsEnabled) {
              if (safeDoc.text && safeDoc.text.length > 0) {
                speak(`${safeDoc.senderName} says: ${safeDoc.text}`);
              }
            }
          }
        }
      },
    );
  } catch (error) {
    errorMessage.value = t("chat.error_loading_messages");
    return () => {};
  }
};

const loadOlderMessages = async () => {
  if (loadingMore.value || !hasMore.value || !props.lobbyId) return;
  loadingMore.value = true;

  try {
    const res = await tables.listRows({ databaseId: dbId, tableId: messagesCollectionId, queries: [
              Query.equal("lobbyId", props.lobbyId),
              Query.orderDesc("timeStamp"),
              Query.limit(MESSAGES_PER_PAGE),
              Query.offset(messages.value.length),
            ] });

    const olderMessages = res.rows
      .reverse()
      .map(applyFilters) as ChatMessage[];
    messages.value = [...olderMessages, ...messages.value];
    hasMore.value = messages.value.length < res.total;
  } catch (error) {
    console.error("Failed to load older messages:", error);
  } finally {
    loadingMore.value = false;
  }
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

watch(messages, () => {
  nextTick(() => {
    if (chatContainer.value && isAtBottom.value) {
      scrollToBottom();
    }
  });
});

const chatInput = ref<HTMLTextAreaElement | null>(null);

const sendMessage = async () => {
  const trimmedMessage = newMessage.value.trim();
  if (!trimmedMessage) return;

  const stripWeirdUnicode = (str: string) =>
    str.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

  const safeMessage = sanitize(stripWeirdUnicode(trimmedMessage));
  if (!safeMessage) return;

  const truncatedMessage = safeMessage.substring(0, maxLength);
  const userId = userStore.user?.$id || "anonymous";
  const senderName =
    userStore.user?.name || userStore.user?.prefs?.name || "Anonymous";

  // ── Optimistic insert: show message immediately ────────────────
  const optimisticId = `__optimistic_${Date.now()}_${Math.random()}`;
  const optimisticMsg: ChatMessage = {
    $id: optimisticId,
    lobbyId: props.lobbyId,
    senderId: userId,
    senderName,
    text: prefs.chatProfanityFilter
      ? filter.clean(truncatedMessage)
      : truncatedMessage,
    timeStamp: new Date().toISOString(),
    // Satisfy Models.Document shape with stubs
    $collectionId: "",
    $databaseId: "",
    $createdAt: "",
    $updatedAt: "",
    $permissions: [],
    $sequence: 0,
  };
  messages.value.push(optimisticMsg);
  newMessage.value = "";
  playSfx(SFX.chatSend);

  await nextTick(() => {
    scrollToBottom();
  });

  // ── Send to server ─────────────────────────────────────────────
  try {
    errorMessage.value = null;
    const result = await $fetch("/api/chat/send", {
      method: "POST",
      body: {
        lobbyId: props.lobbyId,
        userId,
        text: truncatedMessage,
      },
    });

    // Replace the optimistic ID with the real server ID so the
    // Realtime echo can be deduplicated.
    const idx = messages.value.findIndex((m) => m.$id === optimisticId);
    const msg = messages.value[idx];
    if (idx !== -1 && msg) {
      msg.$id = result.messageId;
    }
    optimisticIds.add(result.messageId);
  } catch (error: any) {
    // Remove the optimistic message on failure
    const idx = messages.value.findIndex((m) => m.$id === optimisticId);
    if (idx !== -1) messages.value.splice(idx, 1);

    if (error?.data?.statusMessage) {
      errorMessage.value = `${t("chat.error_sending")}: ${error.data.statusMessage}`;
    } else if (error?.message) {
      errorMessage.value = `${t("chat.error_sending")}: ${error.message}`;
    } else {
      errorMessage.value = t("chat.error_sending");
    }
  }
};

let unsubscribe: (() => void) | null = null;

onMounted(() => {
  nextTick(() => {
    scrollToBottom();
  });

  loadMessages().then((unsub) => {
    unsubscribe = unsub;
  });
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});
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
