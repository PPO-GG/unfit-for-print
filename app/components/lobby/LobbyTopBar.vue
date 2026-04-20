<template>
  <header class="lobby-topbar lobby-panel">
    <!-- Left: Logo + Back -->
    <div class="lobby-topbar-left">
      <div class="lobby-logomark">
        UNFIT<br />FOR<br />PRINT
      </div>
      <button class="neon-btn neon-btn--ghost lobby-topbar-back" @click="$emit('leave')">
        ← Leave
      </button>
    </div>

    <!-- Center: Lobby code -->
    <div class="lobby-topbar-code">
      <span class="lobby-topbar-code-label">CODE</span>
      <span class="lobby-topbar-code-value">{{ code }}</span>
      <button
        class="neon-btn neon-btn--ghost lobby-topbar-copy"
        :class="{ 'lobby-topbar-copy--done': copied }"
        @click="copyLink"
      >
        {{ copied ? "Copied!" : "Copy Link" }}
      </button>
    </div>

    <!-- Right: Chat + Settings toggles -->
    <div class="lobby-topbar-right">
      <button class="neon-btn neon-btn--ghost" @click="$emit('toggle-chat')">
        💬
      </button>
      <button class="neon-btn neon-btn--ghost" @click="$emit('open-settings')">
        ⚙
      </button>
    </div>
  </header>
</template>

<script lang="ts" setup>
const props = defineProps<{ code: string }>();
const emit = defineEmits<{
  (e: "leave"): void;
  (e: "toggle-chat"): void;
  (e: "open-settings"): void;
}>();

const config = useRuntimeConfig();
const { notify } = useNotifications();
const { t } = useI18n();

const copied = ref(false);

function copyLink() {
  if (typeof window === "undefined") return;
  const url = `${config.public.baseUrl}/game/${props.code}`;
  navigator.clipboard.writeText(url).then(() => {
    notify({ title: t("lobby.code_copied"), color: "success", icon: "i-mdi-clipboard-check" });
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  }).catch(() => {
    notify({ title: t("lobby.error_code_copied"), color: "error", icon: "i-mdi-alert-circle" });
  });
}
</script>

<style scoped>
.lobby-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 20px;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
  flex-shrink: 0;
  z-index: 10;
  position: relative;
}

.lobby-topbar-left,
.lobby-topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.lobby-logomark {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #0d0f1a;
  border: 1.5px solid rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Archivo Black', sans-serif;
  font-size: 6.5px;
  line-height: 1;
  text-align: center;
  color: var(--lb-ink);
  letter-spacing: -0.01em;
  flex-shrink: 0;
}

.lobby-topbar-back {
  font-size: 11px;
  padding: 4px 10px;
}

.lobby-topbar-code {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--lb-line-strong);
  border-radius: 8px;
  padding: 6px 14px;
}

.lobby-topbar-code-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--lb-ink-muted);
}

.lobby-topbar-code-value {
  font-family: 'Archivo Black', sans-serif;
  font-size: 22px;
  letter-spacing: 0.18em;
  color: var(--lb-ink);
  line-height: 1;
}

.lobby-topbar-copy {
  font-size: 10px;
  padding: 4px 10px;
}

.lobby-topbar-copy--done {
  color: var(--lb-accent-lime);
  border-color: var(--lb-accent-lime);
}
</style>
