<template>
  <Transition name="lobby-drawer">
    <aside v-if="open" class="lobby-chat-panel lobby-panel">
      <div class="lobby-chat-header">
        <span class="lobby-chip">
          <span class="live-dot" />
          Chat
        </span>
        <button class="neon-btn neon-btn--ghost lobby-chat-close" @click="$emit('close')">✕</button>
      </div>

      <div ref="scrollEl" class="lobby-chat-messages">
        <div
          v-for="msg in messages"
          :key="msg.id"
          :class="['lobby-chat-row', msg.isSystem ? 'lobby-chat-row--system' : '']"
        >
          <template v-if="msg.isSystem">
            <span class="lobby-chat-system-text">— {{ msg.text }} —</span>
          </template>
          <template v-else>
            <span class="lobby-chat-who">{{ msg.name }}</span>
            <span class="lobby-chat-text">{{ msg.text }}</span>
          </template>
        </div>
        <div v-if="messages.length === 0" class="lobby-chat-empty">
          No messages yet
        </div>
      </div>

      <form class="lobby-chat-form" @submit.prevent="handleSend">
        <input
          v-model="draft"
          class="lobby-chat-input"
          placeholder="Say something…"
          maxlength="300"
          autocomplete="off"
        />
        <button type="submit" class="neon-btn neon-btn--primary lobby-chat-send" :disabled="!draft.trim()">
          ↑
        </button>
      </form>
    </aside>
  </Transition>
</template>

<script lang="ts" setup>
import { useLobbyChat } from "~/composables/useLobbyChat";
import { useLobby } from "~/composables/useLobby";
import type { ChatMessage } from "~/composables/useLobbyReactive";

const props = defineProps<{
  open: boolean;
  messages: ChatMessage[];
}>();

defineEmits<{ (e: "close"): void }>();

const { lobbyDoc } = useLobby();
const chat = useLobbyChat(lobbyDoc);

const draft = ref("");
const scrollEl = ref<HTMLElement | null>(null);

function handleSend() {
  const text = draft.value.trim();
  if (!text) return;
  chat.sendMessage(text);
  draft.value = "";
}

// Auto-scroll to bottom when new messages arrive
watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
  },
);
</script>

<style scoped>
.lobby-chat-panel {
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  width: 300px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  border-radius: 0;
  border-right: none;
  border-top: none;
  border-bottom: none;
}

.lobby-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--lb-line);
  flex-shrink: 0;
}

.lobby-chat-close {
  padding: 4px 8px;
  font-size: 12px;
}

.lobby-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--lb-line-strong) transparent;
}

.lobby-chat-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lobby-chat-row--system {
  align-items: center;
}

.lobby-chat-system-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lb-ink-muted);
  font-style: italic;
}

.lobby-chat-who {
  font-family: 'Archivo Black', sans-serif;
  font-size: 10px;
  letter-spacing: 0.05em;
  color: var(--lb-ink-dim);
}

.lobby-chat-text {
  font-size: 13px;
  color: var(--lb-ink);
  line-height: 1.4;
  word-break: break-word;
}

.lobby-chat-empty {
  font-size: 11px;
  color: var(--lb-ink-muted);
  text-align: center;
  margin: auto;
}

.lobby-chat-form {
  display: flex;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid var(--lb-line);
  flex-shrink: 0;
}

.lobby-chat-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--lb-line-strong);
  border-radius: 6px;
  padding: 7px 10px;
  color: var(--lb-ink);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}
.lobby-chat-input:focus { border-color: var(--lb-accent); }
.lobby-chat-input::placeholder { color: var(--lb-ink-muted); }

.lobby-chat-send {
  padding: 7px 12px;
  font-size: 14px;
}
</style>
