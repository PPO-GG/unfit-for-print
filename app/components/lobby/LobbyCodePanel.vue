<template>
  <div class="lobby-code-panel lobby-panel">
    <div class="lobby-code-panel-header">
      <div class="lobby-code-panel-label">LOBBY CODE</div>
      <div class="lobby-code-panel-sub">Share with your crew</div>
    </div>

    <div class="lobby-ticket-sep" />

    <div class="lobby-code-panel-tiles">
      <div
        v-for="(char, i) in codeChars"
        :key="i"
        class="lobby-code-tile"
      >{{ char }}</div>
    </div>

    <div class="lobby-ticket-sep" />

    <div class="lobby-code-panel-buttons">
      <button class="neon-btn lobby-code-panel-btn" @click="copyCode">
        {{ codeCopied ? "COPIED ✓" : "COPY CODE" }}
      </button>
      <button class="neon-btn lobby-code-panel-btn" @click="copyLink">
        {{ linkCopied ? "COPIED ✓" : "INVITE LINK" }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
const props = defineProps<{ code: string }>();

const config = useRuntimeConfig();
const { notify } = useNotifications();
const { t } = useI18n();

const codeCopied = ref(false);
const linkCopied = ref(false);

const codeChars = computed(() => props.code.split(""));

async function copyCode() {
  if (typeof window === "undefined") return;
  try {
    await navigator.clipboard.writeText(props.code);
    codeCopied.value = true;
    notify({ title: t("lobby.code_copied"), color: "success", icon: "i-mdi-clipboard-check" });
    setTimeout(() => { codeCopied.value = false; }, 1500);
  } catch {
    notify({ title: t("lobby.error_code_copied"), color: "error", icon: "i-mdi-alert-circle" });
  }
}

async function copyLink() {
  if (typeof window === "undefined") return;
  const url = `${config.public.baseUrl}/game/${props.code}`;
  try {
    await navigator.clipboard.writeText(url);
    linkCopied.value = true;
    notify({ title: t("lobby.code_copied"), color: "success", icon: "i-mdi-clipboard-check" });
    setTimeout(() => { linkCopied.value = false; }, 1500);
  } catch {
    notify({ title: t("lobby.error_code_copied"), color: "error", icon: "i-mdi-alert-circle" });
  }
}
</script>

<style scoped>
.lobby-code-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lobby-code-panel-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lobby-code-panel-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--lb-ink-muted);
  line-height: 1;
}

.lobby-code-panel-sub {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 13px;
  color: var(--lb-ink-dim);
  line-height: 1;
}

.lobby-code-panel-tiles {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
}

.lobby-code-panel-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.lobby-code-panel-btn {
  padding: 8px 10px;
  font-size: 11px;
}
</style>
