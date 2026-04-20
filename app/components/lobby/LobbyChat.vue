<template>
  <aside class="lobby-chat-panel lobby-panel" :class="{ 'lobby-chat-panel--open': open }">
    <button
      class="lobby-chat-toggle"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="lobby-chat-toggle-left">
        <span class="lobby-chat-toggle-icon" aria-hidden="true">💬</span>
        <span class="lobby-chat-toggle-title">LOBBY CHAT</span>
        <span class="lobby-chip lobby-chat-toggle-chip">{{ messageCount }}</span>
      </span>
      <span class="lobby-chat-toggle-right" aria-hidden="true">
        <span class="lobby-chat-chevron" :class="{ 'lobby-chat-chevron--open': open }">▾</span>
      </span>
    </button>

    <div v-if="open" class="lobby-chat-expand">
      <div class="lobby-ticket-sep" />
      <div ref="scrollEl" class="lobby-chat-messages">
        <template v-for="(msg, i) in messages" :key="msg.id ?? i">
          <div v-if="msg.isSystem" class="lobby-chat-row lobby-chat-row--system">
            <span class="lobby-chat-sys-rule" />
            <span class="lobby-chat-bubble lobby-chat-bubble--system">{{ msg.text }}</span>
            <span class="lobby-chat-sys-rule lobby-chat-sys-rule--grow" />
          </div>
          <div v-else class="lobby-chat-row">
            <span class="lobby-chat-who">{{ msg.name }}</span>
            <span class="lobby-chat-bubble">{{ msg.text }}</span>
          </div>
        </template>
        <div v-if="messages.length === 0" class="lobby-chat-empty">
          No messages yet
        </div>
      </div>

      <form class="lobby-chat-form" @submit.prevent="handleSend">
        <input
          v-model="draft"
          class="lobby-chat-input"
          placeholder="Say something regrettable…"
          maxlength="300"
          autocomplete="off"
        />
        <button
          type="submit"
          class="neon-btn neon-btn--primary lobby-chat-send"
          aria-label="Send message"
          :disabled="!draft.trim()"
        >
          SEND
        </button>
      </form>
    </div>
  </aside>
</template>

<script lang="ts" setup>
import { useLobbyChat } from "~/composables/useLobbyChat";
import { useLobby } from "~/composables/useLobby";
import type { ChatMessage } from "~/composables/useLobbyReactive";

const props = defineProps<{
  messages: ChatMessage[];
}>();

const { lobbyDoc } = useLobby();

// useLobbyChat throws if the Y.Doc isn't ready yet (requireDoc()).
// Wrap construction so the component can still mount before the doc connects.
let chat: ReturnType<typeof useLobbyChat> | null = null;
try {
  chat = useLobbyChat(lobbyDoc);
} catch (err) {
  console.warn("[LobbyChat] Failed to init chat composable:", err);
  chat = null;
}

const open = ref(false);
const draft = ref("");
const scrollEl = ref<HTMLElement | null>(null);

const messageCount = computed(
  () => props.messages.filter((m) => !m.isSystem).length,
);

function handleSend() {
  const text = draft.value.trim();
  if (!text) return;
  if (!chat || typeof chat.sendMessage !== "function") {
    console.warn("[LobbyChat] Chat not ready — message dropped");
    return;
  }
  try {
    chat.sendMessage(text);
    draft.value = "";
  } catch (err) {
    console.warn("[LobbyChat] sendMessage failed:", err);
  }
}

watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
  },
);

watch(open, async (isOpen) => {
  if (!isOpen) return;
  await nextTick();
  if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
});
</script>

<style scoped>
.lobby-chat-panel {
  /* Lives inside the right sidebar column — no absolute positioning needed. */
  width: 100%;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lobby-chat-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: var(--lb-ink);
  cursor: pointer;
  transition: background 150ms;
}
.lobby-chat-toggle:hover { background: rgba(255, 255, 255, 0.04); }

.lobby-chat-toggle-left,
.lobby-chat-toggle-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lobby-chat-toggle-icon {
  font-size: 14px;
  line-height: 1;
}

.lobby-chat-toggle-title {
  font-family: 'Archivo Black', sans-serif;
  font-size: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.lobby-chat-toggle-chip {
  padding: 1px 7px;
  font-size: 10px;
}

.lobby-chat-chevron {
  display: inline-block;
  font-size: 12px;
  color: var(--lb-ink-muted);
  transition: transform 180ms ease;
}
.lobby-chat-chevron--open { transform: rotate(180deg); }

.lobby-chat-expand {
  display: flex;
  flex-direction: column;
}

.lobby-chat-messages {
  max-height: 260px;
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
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.lobby-chat-sys-rule {
  height: 1px;
  width: 12px;
  background: var(--lb-line-strong);
  flex-shrink: 0;
}

.lobby-chat-sys-rule--grow {
  flex: 1;
  width: auto;
}

.lobby-chat-who {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lb-ink-muted);
  margin-right: 8px;
}

.lobby-chat-empty {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--lb-ink-muted);
  text-align: center;
  padding: 16px 0;
}

.lobby-chat-form {
  display: flex;
  gap: 8px;
  padding: 8px;
  border-top: 1px solid var(--lb-line);
}

.lobby-chat-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: 8px 10px;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 14px;
  color: var(--lb-ink);
}
.lobby-chat-input::placeholder { color: var(--lb-ink-muted); }

.lobby-chat-send {
  padding: 6px 12px;
  font-size: 11px;
}
</style>
