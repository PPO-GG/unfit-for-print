<template>
  <div class="lobby-player-list lobby-panel">
    <div class="lpl-header">
      <div class="lpl-header-label">Players · {{ players.length }} / {{ maxSeats }}</div>
      <button v-if="isHostUser" class="lpl-add-bot-link" @click="$emit('add-bot')">+ Bot</button>
    </div>
    <div class="lpl-list">
      <div v-for="p in players" :key="p.$id" class="lpl-row">
        <AvatarDecoration :decoration-id="p.activeDecoration ?? null">
          <div
            class="lpl-avatar"
            :class="{ 'lpl-avatar--image': avatarUrlFor(p) && !imgErrors[p.$id] }"
            :style="avatarUrlFor(p) && !imgErrors[p.$id] ? {} : avatarStyle(p)"
          >
            <img
              v-if="avatarUrlFor(p) && !imgErrors[p.$id]"
              :src="avatarUrlFor(p) ?? ''"
              :alt="p.name"
              referrerpolicy="no-referrer"
              @error="imgErrors[p.$id] = true"
            />
            <span v-else>{{ initials(p) }}</span>
          </div>
        </AvatarDecoration>
        <div class="lpl-body">
          <div class="lpl-name">
            <span>{{ p.name }}</span>
            <span v-if="p.isHost" title="Host">👑</span>
            <span v-if="p.playerType === 'bot'" class="lpl-bot-badge">BOT</span>
          </div>
          <div :class="['lpl-status', statusClass(p)]">{{ statusLabel(p) }}</div>
        </div>
        <button
          v-if="p.playerType === 'bot' && isHostUser"
          class="lpl-kick"
          :aria-label="`Remove ${p.name}`"
          @click="$emit('kick', p.$id)"
        >✕</button>
      </div>
      <div v-if="players.length === 0" class="lpl-empty">No players yet</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { Player } from "~/types/player";
import { getPlayerAvatarUrl } from "~/composables/usePlayerAvatar";

defineProps<{
  players: Player[];
  maxSeats: number;
  isHostUser: boolean;
}>();

defineEmits<{
  (e: "add-bot"): void;
  (e: "kick", playerId: string): void;
}>();

const imgErrors = reactive<Record<string, boolean>>({});
function avatarUrlFor(p: Player): string | null { return getPlayerAvatarUrl(p); }

const PALETTE = [
  "#5865f2", "#f43f5e", "#22d3ee", "#84cc16",
  "#f59e0b", "#a78bfa", "#fb7185", "#34d399",
];

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function initials(p: Player): string {
  if (p.playerType === "bot") return "🤖";
  const name = p.name?.trim() ?? "";
  if (!name) return "?";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function avatarStyle(p: Player): Record<string, string> {
  if (p.playerType === "bot") {
    return { background: "linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)", color: "#0d0f1a" };
  }
  const color = colorFromId(p.userId ?? p.$id ?? "");
  return {
    background: `linear-gradient(135deg, ${color}aa 0%, ${color}55 100%)`,
    color: "#0d0f1a",
  };
}

function statusLabel(p: Player): string {
  if (p.playerType === "bot") return "✓ BOT · ready";
  if (p.ready) return "✓ Ready";
  return "Thinking";
}

function statusClass(p: Player): string {
  if (p.playerType === "bot") return "bot";
  if (p.ready) return "ready";
  return "";
}
</script>

<style scoped>
.lobby-player-list {
  display: flex;
  flex-direction: column;
  height: min(46vh, 420px);
  min-height: 0;
  padding: 16px;
}
.lpl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.lpl-header-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--lb-ink-muted);
}
.lpl-add-bot-link {
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
.lpl-add-bot-link:hover { text-decoration: underline; }
.lpl-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--lb-line-strong) transparent;
}
.lpl-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background 120ms;
}
.lpl-row:hover { background: rgba(255, 255, 255, 0.04); }
.lpl-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Archivo Black', sans-serif;
  font-size: 10px;
  color: #0d0f1a;
  flex-shrink: 0;
  line-height: 1;
  overflow: hidden;
}
.lpl-avatar--image {
  background: #1a2040;
}
.lpl-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 50%;
}
.lpl-body { flex: 1; min-width: 0; }
.lpl-name {
  font-family: 'Archivo Black', sans-serif;
  font-size: 12px;
  line-height: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--lb-ink);
  letter-spacing: 0.04em;
}
.lpl-bot-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--lb-accent-yellow);
  color: #0d0f1a;
  letter-spacing: 0.1em;
}
.lpl-status {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--lb-ink-muted);
  margin-top: 3px;
}
.lpl-status.ready { color: var(--lb-accent-lime); }
.lpl-status.bot { color: var(--lb-accent-yellow); }
.lpl-kick {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: var(--lb-ink-muted);
  cursor: pointer;
  transition: color 150ms, background 150ms;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.lpl-kick:hover {
  color: oklch(68% 0.22 25);
  background: rgba(255, 80, 80, 0.08);
}
.lpl-empty {
  text-align: center;
  padding: 16px 0;
  color: var(--lb-ink-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
</style>
