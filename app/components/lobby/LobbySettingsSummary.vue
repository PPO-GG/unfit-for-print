<template>
  <div class="lobby-settings-summary lobby-panel">
    <div class="lss-header">
      <div class="lss-header-label">Game Settings</div>
      <button class="lss-edit-link" @click="$emit('edit')">Edit</button>
    </div>
    <template v-if="settings">
      <div class="lss-kv-list">
        <div class="lss-kv"><span class="lss-k">First to</span><span class="lss-v">{{ settings.maxPoints }}</span></div>
        <div class="lss-kv"><span class="lss-k">Cards / player</span><span class="lss-v">{{ settings.cardsPerPlayer }}</span></div>
        <div class="lss-kv"><span class="lss-k">Max pick</span><span class="lss-v">{{ settings.maxPick }}</span></div>
        <div class="lss-kv"><span class="lss-k">Manual draw</span><span class="lss-v">{{ settings.manualDraw ? "On" : "Off" }}</span></div>
        <div class="lss-kv"><span class="lss-k">Password</span><span class="lss-v">{{ requirePassword ? "Required" : "Open" }}</span></div>
      </div>

      <div class="lobby-ticket-sep lss-sep" />

      <div class="lss-packs-label">Active Packs</div>
      <div class="lss-packs-list">
        <span v-for="pack in settings.cardPacks" :key="pack" class="lobby-pack-chip lobby-pack-chip--on lss-pack-chip">{{ pack }}</span>
        <span v-if="settings.cardPacks.length === 0" class="lss-no-packs">None selected</span>
      </div>
    </template>
    <div v-else class="lss-loading">Loading settings…</div>
  </div>
</template>

<script lang="ts" setup>
import type { LobbySettings } from "~/composables/useLobbyReactive";

const props = defineProps<{ settings: LobbySettings | null }>();
defineEmits<{ (e: "edit"): void }>();

const requirePassword = computed(() => !!(props.settings?.password && props.settings.password.length > 0));
</script>

<style scoped>
.lobby-settings-summary { padding: 16px; }
.lss-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.lss-header-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--lb-ink-muted);
}
.lss-edit-link {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--lb-accent);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}
.lss-edit-link:hover { text-decoration: underline; }
.lss-kv-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lss-kv {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.lss-k {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--lb-ink-muted);
}
.lss-v {
  font-family: 'Archivo Black', sans-serif;
  font-size: 13px;
  color: var(--lb-ink);
}
.lss-sep { margin: 12px 0; }
.lss-packs-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--lb-ink-muted);
  margin-bottom: 8px;
}
.lss-packs-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 80px;
  overflow-y: auto;
  padding-right: 4px;
}
.lss-pack-chip {
  padding: 4px 8px !important;
  font-size: 10px !important;
  max-width: 100%;
  overflow-wrap: anywhere;
  white-space: normal;
}
.lss-no-packs {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--lb-ink-muted);
}
.lss-loading {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--lb-ink-muted);
  text-align: center;
  padding: 12px 0;
}
</style>
