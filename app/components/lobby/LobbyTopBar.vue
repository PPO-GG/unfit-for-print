<template>
  <header class="lobby-topbar">
    <div class="lobby-topbar-left">
      <button class="neon-btn neon-btn--danger lobby-topbar-leave" @click="$emit('leave')">
        <span aria-hidden="true">↩</span> LEAVE
      </button>
      <div class="lobby-topbar-logo-group">
        <div class="lobby-logomark">UNFIT<br />FOR<br />PRINT</div>
        <div class="lobby-topbar-lobby-meta">
          <div class="lobby-topbar-lobby-label">LOBBY</div>
          <div class="lobby-topbar-lobby-name">{{ lobbyName || "UNTITLED LOBBY" }}</div>
        </div>
      </div>
    </div>

    <div class="lobby-topbar-right">
      <div class="lobby-topbar-summary">
        <span>FIRST TO <b>{{ maxPoints }}</b></span>
        <span class="lobby-topbar-summary-sep">·</span>
        <span>PICK ≤ <b>{{ maxPick }}</b></span>
        <span class="lobby-topbar-summary-sep">·</span>
        <span><b>{{ packCount }}</b> PACKS</span>
      </div>
      <button class="neon-btn lobby-topbar-settings" @click="$emit('open-settings')">
        <span aria-hidden="true">⚙</span> SETTINGS
      </button>
    </div>
  </header>
</template>

<script lang="ts" setup>
defineProps<{
  lobbyName: string;
  maxPoints: number;
  maxPick: number;
  packCount: number;
}>();

defineEmits<{
  (e: "leave"): void;
  (e: "open-settings"): void;
}>();
</script>

<style scoped>
.lobby-topbar {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 24px;
  flex-shrink: 0;
}

.lobby-topbar-left,
.lobby-topbar-right {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.lobby-topbar-leave {
  padding: 8px 12px;
  font-size: 11px;
}

.lobby-topbar-logo-group {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.lobby-logomark {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: #0d0f1a;
  border: 1.5px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.03);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Archivo Black', sans-serif;
  font-size: 8px;
  line-height: 0.95;
  text-align: center;
  color: var(--lb-ink);
  letter-spacing: -0.01em;
  flex-shrink: 0;
}

.lobby-topbar-lobby-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.lobby-topbar-lobby-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--lb-ink-muted);
  line-height: 1;
}

.lobby-topbar-lobby-name {
  font-family: 'Archivo Black', sans-serif;
  font-size: 15px;
  letter-spacing: 0.02em;
  color: var(--lb-ink);
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}

.lobby-topbar-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid var(--lb-line);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--lb-ink-muted);
  white-space: nowrap;
}

.lobby-topbar-summary b {
  color: var(--lb-ink);
  font-weight: 700;
}

.lobby-topbar-summary-sep {
  color: var(--lb-ink-muted);
  opacity: 0.6;
}

.lobby-topbar-settings {
  padding: 8px 12px;
  font-size: 11px;
}

@media (max-width: 768px) {
  .lobby-topbar-logo-group,
  .lobby-topbar-summary {
    display: none;
  }
}
</style>
